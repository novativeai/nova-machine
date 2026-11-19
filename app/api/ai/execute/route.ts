import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { AICommandRequest, AICommandResponse, ToolCallRequest } from '@/types';
import { buildCommandSystemPrompt } from '@/lib/tools/system-prompt';
import { allCanvasTools } from '@/lib/tools/canvas-tools';
import { verifyIdToken } from '@/lib/firebase-admin';

// ============================================================================
// AI COMMAND EXECUTION API ROUTE
// ============================================================================

/**
 * POST /api/ai/execute
 *
 * Receives a natural language command + canvas context.
 * Sends to Claude with tool definitions.
 * Returns a plan + ordered tool calls for client-side execution.
 *
 * Data flow:
 * Client → { command, canvasContext } → Claude API → { plan, toolCalls } → Client
 * Client then executes toolCalls sequentially via ToolRegistry.
 */
export async function POST(request: Request) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(idToken);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as AICommandRequest;
    const { command, canvasContext } = body;

    if (!command?.trim()) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY in your environment.' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build system prompt with current canvas context
    const systemPrompt = buildCommandSystemPrompt(canvasContext);

    // Convert tool definitions to Claude API format
    const tools: Anthropic.Messages.Tool[] = allCanvasTools.map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      input_schema: {
        type: 'object' as const,
        properties: Object.fromEntries(
          t.definition.parameters.map((p) => [
            p.name,
            {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {}),
              ...(p.items ? { items: p.items } : {}),
            },
          ])
        ),
        required: t.definition.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    }));

    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: [
        {
          role: 'user',
          content: command,
        },
      ],
    });

    // Parse response: extract text (plan) and tool_use blocks (tool calls)
    let plan = '';
    const toolCalls: ToolCallRequest[] = [];
    let isChain = false;

    for (const block of response.content) {
      if (block.type === 'text') {
        plan += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
        if (block.name === 'create_chain') {
          isChain = true;
        }
      }
    }

    // If Claude wants to use tools but hasn't finished (stop_reason === 'tool_use'),
    // we collect all tool uses from this turn. The client will execute them.
    // We don't do multi-turn here - single pass tool selection.

    const result: AICommandResponse = {
      plan: plan || 'Executing requested operations...',
      toolCalls,
      isChain,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI command execution error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
