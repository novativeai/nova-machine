import type { TagType, TagMatch } from '@/types';

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

/**
 * Format a name as a valid tag (replace spaces with underscores, strip special chars)
 * Example: "John Doe" → "@John_Doe"
 */
export function formatNameAsTag(name: string): string {
  // Replace spaces with underscores, remove non-alphanumeric except underscores
  const formatted = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  return `@${formatted}`;
}

/**
 * Check if a name is valid for use as a tag (not default/empty)
 */
export function isValidNameForTag(name: string): boolean {
  const trimmed = name.trim();
  // Invalid if empty, "New Element", or only special characters
  if (!trimmed || trimmed === 'New Element') return false;
  // Must have at least one alphanumeric character
  return /[a-zA-Z0-9]/.test(trimmed);
}

/**
 * Interface for name-based tag match
 */
export interface NameTagMatch {
  tag: string;           // The full tag string (e.g., "@Alice")
  name: string;          // The name portion (e.g., "Alice")
  startPosition: number;
  endPosition: number;
}

/**
 * Parse name-based tags from a prompt string
 * Matches patterns like @Alice, @John_Doe (capitalized, alphanumeric with underscores)
 */
export function parseNameTags(prompt: string, knownNameTags: string[]): NameTagMatch[] {
  const matches: NameTagMatch[] = [];

  // Create a regex that matches any of the known name tags
  if (knownNameTags.length === 0) return matches;

  // Escape special regex characters and sort by length (longest first to avoid partial matches)
  const sortedTags = [...knownNameTags].sort((a, b) => b.length - a.length);
  const escapedTags = sortedTags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escapedTags.join('|')})(?![a-zA-Z0-9_])`, 'g');

  let match;
  while ((match = pattern.exec(prompt)) !== null) {
    const tag = match[1];
    matches.push({
      tag,
      name: tag.slice(1).replace(/_/g, ' '), // Remove @ and convert underscores to spaces
      startPosition: match.index,
      endPosition: match.index + tag.length,
    });
  }

  return matches.sort((a, b) => a.startPosition - b.startPosition);
}

/**
 * Parse all tags from a prompt - both standard (@Element1) and name-based (@Alice)
 */
export function parseAllTags(
  prompt: string,
  nameTagMap: Map<string, { type: TagType; elementTag: string }>
): Array<TagMatch | (NameTagMatch & { type: TagType; elementTag: string })> {
  const standardTags = parseTags(prompt);
  const nameTags = parseNameTags(prompt, Array.from(nameTagMap.keys()));

  // Combine and enrich name tags with type info
  const enrichedNameTags = nameTags.map((nt) => {
    const info = nameTagMap.get(nt.tag);
    return {
      ...nt,
      type: info?.type || 'element' as TagType,
      elementTag: info?.elementTag || nt.tag,
      index: 0, // Name tags don't have numeric indices
    };
  });

  // Combine all tags and sort by position
  const allTags = [...standardTags, ...enrichedNameTags];
  return allTags.sort((a, b) => a.startPosition - b.startPosition);
}

/**
 * Translate name tags to element tags in a prompt for API submission
 */
export function translateNameTagsForApi(
  prompt: string,
  nameTagMap: Map<string, string> // nameTag -> elementTag (e.g., "@Alice" -> "@Element1")
): string {
  let translated = prompt;

  // Sort by tag length descending to avoid partial replacements
  const sortedEntries = Array.from(nameTagMap.entries()).sort(
    ([a], [b]) => b.length - a.length
  );

  for (const [nameTag, elementTag] of sortedEntries) {
    // Use word boundary to avoid partial matches
    const escaped = nameTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escaped}(?![a-zA-Z0-9_])`, 'g');
    translated = translated.replace(pattern, elementTag);
  }

  return translated;
}

/**
 * Validate tags including name-based tags
 */
export function validateAllTags(
  prompt: string,
  connectedTags: string[],           // Standard tags like @Element1
  nameTagToElementTag: Map<string, string> // Name tags mapped to element tags
): { valid: boolean; missing: string[] } {
  // First, translate any name tags to their element counterparts
  const translatedPrompt = translateNameTagsForApi(prompt, nameTagToElementTag);

  // Now validate the translated prompt
  return validateTags(translatedPrompt, connectedTags);
}
