export interface Participant {
  id: string; // matches auth UID or local uuid
  nickname: string;
  email: string;
  favoriteTeam: string;
  avatarColor: string; // tailwind color prefix like "emerald", "violet", "amber", "rose", etc.
  points: number;
  exactHits: number;
  outcomeHits: number;
  isLocallyCreated?: boolean;
  subscribedTeams: string[];
  groupName: string; // "Familia" | "Compas" | "Cretas"
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  group: string;
  dateTime: string; // ISO format string
  homeScore: number; // -1 if not played
  awayScore: number; // -1 if not played
  status: 'scheduled' | 'live' | 'finished';
  stadium?: string;
}

export interface Prediction {
  id: string; // Combines userId_matchId
  userId: string;
  matchId: string;
  homePredict: number; // -1 if not predicted
  awayPredict: number; // -1 if not predicted
  pointsEarned: number;
  calculated: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  avatarColor: string;
  text: string;
  timestamp: string; // ISO string
  matchId?: string; // Opt association
}

export interface AppNotification {
  id: string;
  text: string;
  timestamp: string;
  isRead: boolean;
  matchId?: string;
  type: 'goal' | 'system' | 'lock';
}
