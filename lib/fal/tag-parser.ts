import type { TagType, TagMatch, TAG_COLORS } from '@/types';

/**
 * Regular expressions for parsing tags in prompts
 */
const TAG_PATTERNS: Record<TagType, RegExp> = {
  image: /@Image(\d+)/g,
  element: /@Element(\d+)/g,
  video: /@Video(\d+)/g,
};

/**
 * Parse all tags from a prompt string
 */
export function parseTags(prompt: string): TagMatch[] {
  const matches: TagMatch[] = [];

  for (const [type, pattern] of Object.entries(TAG_PATTERNS)) {
    // Create new regex instance to reset lastIndex
    const regex = new RegExp(pattern.source, 'g');
    let match;

    while ((match = regex.exec(prompt)) !== null) {
      matches.push({
        tag: match[0],
        type: type as TagType,
        index: parseInt(match[1], 10),
        startPosition: match.index,
        endPosition: match.index + match[0].length,
      });
    }
  }

  // Sort by position in the prompt
  return matches.sort((a, b) => a.startPosition - b.startPosition);
}

/**
 * Get all unique tags of a specific type from a prompt
 */
export function getTagsOfType(prompt: string, type: TagType): TagMatch[] {
  return parseTags(prompt).filter((t) => t.type === type);
}

/**
 * Check if a specific tag exists in the prompt
 */
export function hasTag(prompt: string, tag: string): boolean {
  const matches = parseTags(prompt);
  return matches.some((m) => m.tag === tag);
}

/**
 * Generate the next available tag for a type
 */
export function generateNextTag(
  existingTags: string[],
  type: TagType
): string {
  const prefix = type === 'image' ? '@Image' : type === 'element' ? '@Element' : '@Video';

  const usedIndices = existingTags
    .filter((t) => t.startsWith(prefix))
    .map((t) => parseInt(t.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n));

  const maxIndex = usedIndices.length > 0 ? Math.max(...usedIndices) : 0;
  return `${prefix}${maxIndex + 1}`;
}

/**
 * Replace tag references in prompt with actual values (for display/validation)
 */
export function replaceTagsWithValues(
  prompt: string,
  tagValues: Record<string, string>
): string {
  let result = prompt;

  for (const [tag, value] of Object.entries(tagValues)) {
    result = result.replace(new RegExp(tag, 'g'), value);
  }

  return result;
}

/**
 * Validate that all tags in prompt have corresponding connected nodes
 */
export function validateTags(
  prompt: string,
  connectedTags: string[]
): { valid: boolean; missing: string[] } {
  const usedTags = parseTags(prompt);
  const missing: string[] = [];

  for (const tagMatch of usedTags) {
    if (!connectedTags.includes(tagMatch.tag)) {
      missing.push(tagMatch.tag);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get color for a tag type
 */
export function getTagColor(type: TagType): string {
  const colors: Record<TagType, string> = {
    image: '#3B82F6',
    element: '#EF4444',
    video: '#8B5CF6',
  };
  return colors[type];
}

/**
 * Get color for a specific tag string
 */
export function getColorForTag(tag: string): string {
  if (tag.startsWith('@Image')) return getTagColor('image');
  if (tag.startsWith('@Element')) return getTagColor('element');
  if (tag.startsWith('@Video')) return getTagColor('video');
  return '#6B7280'; // Default gray
}

/**
 * Extract tag type from tag string
 */
export function getTagType(tag: string): TagType | null {
  if (tag.startsWith('@Image')) return 'image';
  if (tag.startsWith('@Element')) return 'element';
  if (tag.startsWith('@Video')) return 'video';
  return null;
}

/**
 * Create autocomplete suggestions based on connected nodes
 */
export interface TagSuggestion {
  tag: string;
  type: TagType;
  color: string;
  nodeId: string;
  preview?: string; // Thumbnail URL
}

export function createTagSuggestions(
  connectedNodes: Array<{
    id: string;
    type: 'image' | 'video' | 'element';
    tag: string;
    thumbnail?: string;
  }>
): TagSuggestion[] {
  return connectedNodes.map((node) => ({
    tag: node.tag,
    type: node.type,
    color: getTagColor(node.type),
    nodeId: node.id,
    preview: node.thumbnail,
  }));
}
