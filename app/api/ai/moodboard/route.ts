import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { MoodboardRequest, MoodboardResponse, ToolCallRequest } from '@/types';
import { buildMoodboardSystemPrompt } from '@/lib/tools/system-prompt';
import { allCanvasTools } from '@/lib/tools/canvas-tools';
import { verifyIdToken } from '@/lib/firebase-admin';

// ============================================================================
// MOODBOARD GENERATION API ROUTE
// ============================================================================

/**
 * POST /api/ai/moodboard
 *
 * Receives a story/description from the user.
 * Sends to Claude with a specialized moodboard decomposition prompt.
 * Returns a structured plan with characters, scenes, and tool calls.
 *
 * Data flow:
 * Client → { story, style? } → Claude API → { plan, characters, scenes, toolCalls } → Client
 * Client then executes toolCalls via ToolRegistry to build the moodboard on canvas.
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

    const body = (await request.json()) as MoodboardRequest;
    const { story, style } = body;

    if (!story?.trim()) {
      return NextResponse.json(
        { error: 'Story is required' },
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

    // Build specialized moodboard system prompt
    const systemPrompt = buildMoodboardSystemPrompt();

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

    // Build user message with story and optional style
    let userMessage = `Create a moodboard for the following story:\n\n${story}`;
    if (style) {
      userMessage += `\n\nVisual style guidance: ${style}`;
    }

    // Call Claude with tools - use multi-turn to get both analysis and tool calls
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      tools,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    // Parse response
    let plan = '';
    const toolCalls: ToolCallRequest[] = [];
    const characters: MoodboardResponse['characters'] = [];
    const scenes: MoodboardResponse['scenes'] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        plan += block.text;

        // Try to extract structured data from the text plan
        // Claude often describes characters and scenes in its text response
        const charMatches = plan.matchAll(/(?:character|Character):\s*"?([^"\n]+)"?\s*[-–]\s*([^\n]+)/g);
        for (const match of charMatches) {
          characters.push({ name: match[1].trim(), description: match[2].trim() });
        }

        const sceneMatches = plan.matchAll(/(?:scene|Scene)\s*\d*:\s*"?([^"\n]+)"?\s*[-–]\s*([^\n]+)/g);
        for (const match of sceneMatches) {
          scenes.push({ title: match[1].trim(), description: match[2].trim(), characters: [] });
        }
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });

        // Extract characters from create_element_node calls
        if (block.name === 'create_element_node') {
          const input = block.input as Record<string, unknown>;
          characters.push({
            name: (input.name as string) || 'Unknown',
            description: (input.element_type as string) || 'character',
          });
        }
      }
    }

    // Deduplicate characters by name
    const uniqueCharacters = characters.filter(
      (char, index, self) =>
        index === self.findIndex((c) => c.name.toLowerCase() === char.name.toLowerCase())
    );

    const result: MoodboardResponse = {
      plan: plan || 'Building your moodboard...',
      characters: uniqueCharacters,
      scenes,
      toolCalls,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Moodboard generation error:', error);

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
