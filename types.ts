export type ToolId =
  | 'dashboard'
  | 'safety-alerts'
  | 'status-board'
  | 'consensus'
  | 'whiteboard'
  | 'event-creator'
  | 'phone-tree'
  | 'mutual-aid'
  | 'secure-share';

export interface EventDetails {
  title: string;
  date: string;
  location: string;
  description: string;
  safetyInfo: string;
}

export type ContactRole = 'Lead' | 'Member';

export interface Contact {
  id: string;
  name: string;
  contact: string;
  role: ContactRole;
  notes: string;
}

export type AidStatus = 'open' | 'claimed' | 'done';

export interface MutualAidPost {
  id: string;
  type: 'request' | 'offer';
  category: string;
  title: string;
  description: string;
  contact: string;
  timestamp: number;
  urgent: boolean;
}

/**
 * The claim state of a post, stored with the post ID as the key. It is a
 * separate record so that an edit of the post and a claim by a different
 * member do not overwrite each other. No record means "open".
 */
export interface AidClaim {
  postId: string;
  status: Exclude<AidStatus, 'open'>;
  /** The display name of the member who claimed the post. */
  claimedBy: string;
}

export type SightingType = 'raid' | 'checkpoint' | 'surveillance' | 'other';

export interface Sighting {
  id: string;
  type: SightingType;
  location: string;
  /** What the people are doing. */
  description: string;
  /** How many people and vehicles. */
  size: string;
  /** Clothing, markings, agency. */
  uniform: string;
  /** Vehicles, plates, tools. */
  equipment: string;
  timestamp: number;
  /** The member ID of the reporter. A reporter cannot confirm their own report. */
  reporterId: string;
  /** Set when a member marks the location as clear. */
  clearedAt: number | null;
}

/** "I see it too." Stored with the key `${sightingId}:${memberId}`. */
export interface Confirmation {
  sightingId: string;
  memberId: string;
}

export interface Proposal {
  id: string;
  text: string;
  timestamp: number;
  status: 'active' | 'closed';
}

export type VoteType = 'support' | 'reservations' | 'stand-aside' | 'block';

/** Stored with the key `${proposalId}:${memberId}`, so each member has one vote. */
export interface Vote {
  proposalId: string;
  memberId: string;
  type: VoteType;
  /** The reason for a reservation or a block. */
  concern: string;
  /** The display name of the voter at the time of the vote. */
  name: string;
}

export type MemberStatus = 'safe' | 'transit' | 'support' | 'detained';

export interface StatusUser {
  id: string;
  name: string;
  status: MemberStatus;
  note: string;
  lastUpdated: number;
  /** The time by which the member promised to check in again. */
  checkInBy: number | null;
}

export interface WhiteboardStroke {
  id: string;
  /** The member ID of the author. Undo removes only your own strokes. */
  by: string;
  timestamp: number;
  /** x0, y0, x1, y1, ... as fractions of the board width. */
  points: number[];
  color: string;
  /** Line width as a fraction of the board width. */
  width: number;
}
