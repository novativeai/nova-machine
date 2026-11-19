// ============================================================================
// PROJECT & FOLDER MANAGEMENT TYPES
// ============================================================================

/**
 * A project is an organizational container for canvas work.
 * Projects group boards, characters, and scenes under shared #hashtags.
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  /** All hashtags used in this project (stored without '#' prefix) */
  hashtags: string[];
  /** References to SavedBoard IDs belonging to this project */
  boardIds: string[];
  thumbnail?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Summary of a project for display in lists
 */
export interface ProjectSummary {
  id: string;
  name: string;
  hashtags: string[];
  boardCount: number;
  thumbnail?: string;
  updatedAt: string;
}
