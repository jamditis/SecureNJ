
export type ToolId = 'dashboard' | 'event-creator' | 'phone-tree' | 'mutual-aid' | 'secure-share' | 'safety-alerts' | 'consensus' | 'whiteboard' | 'status-board';

export interface EventDetails {
  title: string;
  date: string;
  location: string;
  description: string;
  safetyInfo: string;
}

export interface Contact {
  id: string;
  name: string;
  contact: string;
  role: string;
  notes: string;
}

export interface MutualAidPost {
  id: string;
  type: 'request' | 'offer';
  category: string;
  title: string;
  description: string;
  contact: string;
  timestamp: number;
}

export interface Sighting {
  id: string;
  type: 'raid' | 'checkpoint' | 'surveillance' | 'other';
  location: string;
  description: string;
  timestamp: number;
}

export interface Proposal {
  id: string;
  text: string;
  timestamp: number;
  status: 'active' | 'closed';
}

export type VoteType = 'support' | 'reservations' | 'stand-aside' | 'block';

export interface StatusUser {
  id: string;
  name: string;
  status: 'safe' | 'transit' | 'support' | 'arrested' | 'offline';
  lastUpdated: number;
  note: string;
}

export interface WhiteboardStroke {
  points: number[];
  color: string;
  width: number;
}
