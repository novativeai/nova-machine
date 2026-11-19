// ============================================================================
// NODE LAYOUT ALGORITHMS
// ============================================================================

/**
 * Calculate a grid position for the next node, avoiding overlap with existing nodes.
 * Uses a spiral-out pattern from a base position.
 */
export function getNextPosition(
  existingPositions: Array<{ x: number; y: number }>,
  basePosition: { x: number; y: number } = { x: 400, y: 200 },
  spacing: { x: number; y: number } = { x: 350, y: 300 }
): { x: number; y: number } {
  if (existingPositions.length === 0) {
    return basePosition;
  }

  // Check if base position is occupied (within spacing distance)
  const isOccupied = (pos: { x: number; y: number }) =>
    existingPositions.some(
      (p) => Math.abs(p.x - pos.x) < spacing.x * 0.8 && Math.abs(p.y - pos.y) < spacing.y * 0.8
    );

  // Try base position first
  if (!isOccupied(basePosition)) {
    return basePosition;
  }

  // Spiral outward to find open slot
  for (let ring = 1; ring <= 10; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue; // Only check ring perimeter
        const candidate = {
          x: basePosition.x + dx * spacing.x,
          y: basePosition.y + dy * spacing.y,
        };
        if (!isOccupied(candidate)) {
          return candidate;
        }
      }
    }
  }

  // Fallback: random offset
  return {
    x: basePosition.x + Math.random() * 200 - 100,
    y: basePosition.y + Math.random() * 200 - 100,
  };
}

/**
 * Layout for moodboard nodes:
 * - Characters in a row at the top
 * - Scenes below, flowing left to right
 * - Chains flow downward from each scene
 */
export interface MoodboardLayout {
  characterPositions: Array<{ x: number; y: number }>;
  scenePositions: Array<{ x: number; y: number }>;
}

export function calculateMoodboardLayout(
  characterCount: number,
  sceneCount: number,
  startPosition: { x: number; y: number } = { x: 200, y: 100 }
): MoodboardLayout {
  const CHARACTER_SPACING = 350;
  const SCENE_SPACING = 800;
  const SCENE_Y_OFFSET = 400;

  // Characters across the top
  const totalCharacterWidth = (characterCount - 1) * CHARACTER_SPACING;
  const totalSceneWidth = (sceneCount - 1) * SCENE_SPACING;
  const maxWidth = Math.max(totalCharacterWidth, totalSceneWidth);

  // Center characters relative to scenes
  const characterStartX = startPosition.x + (maxWidth - totalCharacterWidth) / 2;
  const characterPositions = Array.from({ length: characterCount }, (_, i) => ({
    x: characterStartX + i * CHARACTER_SPACING,
    y: startPosition.y,
  }));

  // Scenes below, centered
  const sceneStartX = startPosition.x + (maxWidth - totalSceneWidth) / 2;
  const scenePositions = Array.from({ length: sceneCount }, (_, i) => ({
    x: sceneStartX + i * SCENE_SPACING,
    y: startPosition.y + SCENE_Y_OFFSET,
  }));

  return { characterPositions, scenePositions };
}
