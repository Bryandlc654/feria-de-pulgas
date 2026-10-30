export interface Commodity {
  id: string;
  name: string;
  points: number;
  icon: string;
  bgGradient: string;
  borderColor: string;
  accentColor: string;
  description: string;
}

export const COMMODITIES: Commodity[] = [
  {
    id: 'reloj',
    name: 'Reloj Vintage',
    points: 100,
    icon: '🕰️',
    bgGradient: 'from-amber-500/10 to-amber-500/5',
    borderColor: 'border-amber-500/40',
    accentColor: '#f59e0b',
    description: 'Reloj de cuerda suizo siglo XIX',
  },
  {
    id: 'camara',
    name: 'Cámara Clásica',
    points: 90,
    icon: '📷',
    bgGradient: 'from-sky-500/10 to-sky-500/5',
    borderColor: 'border-sky-500/40',
    accentColor: '#0ea5e9',
    description: 'Cámara telemétrica alemana',
  },
  {
    id: 'gramofono',
    name: 'Gramófono Victoriano',
    points: 80,
    icon: '🎺',
    bgGradient: 'from-yellow-500/10 to-yellow-500/5',
    borderColor: 'border-yellow-500/40',
    accentColor: '#eab308',
    description: 'Con bocina de latón repujado',
  },
  {
    id: 'radio',
    name: 'Radio a Válvulas',
    points: 70,
    icon: '📻',
    bgGradient: 'from-emerald-500/10 to-emerald-500/5',
    borderColor: 'border-emerald-500/40',
    accentColor: '#10b981',
    description: 'Radio de madera de los años 40',
  },
  {
    id: 'cuadro',
    name: 'Pintura al Óleo',
    points: 60,
    icon: '🎨',
    bgGradient: 'from-violet-500/10 to-violet-500/5',
    borderColor: 'border-violet-500/40',
    accentColor: '#8b5cf6',
    description: 'Retrato de época firmado',
  },
  {
    id: 'joya',
    name: 'Joya Preciosa',
    points: 50,
    icon: '💎',
    bgGradient: 'from-cyan-500/10 to-cyan-500/5',
    borderColor: 'border-cyan-500/40',
    accentColor: '#06b6d4',
    description: 'Zafiro engarzado en plata',
  },
  {
    id: 'lampara',
    name: 'Lámpara Art Déco',
    points: 40,
    icon: '🪔',
    bgGradient: 'from-rose-500/10 to-rose-500/5',
    borderColor: 'border-rose-500/40',
    accentColor: '#f43f5e',
    description: 'Lámpara de vitral policromada',
  },
  {
    id: 'libro',
    name: 'Grimorio Antiguo',
    points: 30,
    icon: '📜',
    bgGradient: 'from-zinc-500/10 to-zinc-500/5',
    borderColor: 'border-zinc-500/40',
    accentColor: '#71717a',
    description: 'Tomo encuadernado en cuero',
  },
];

export interface Card {
  id: string; // unique card id for security & tracking
  suit: string; // commodity id
}

export interface PlayerPublic {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  isHost: boolean;
  isConnected: boolean;
  cardCount: number;
  activeOfferCount: number | null; // Quantity offered (1-4) or null
  isWinning?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
}

export interface PlayerPrivate extends PlayerPublic {
  token: string;
  hand: Card[];
  socketId?: string;
  currentOfferCardIds?: string[]; // Server-side secret
}

export interface ActiveOffer {
  playerId: string;
  quantity: number;
  timestamp: number;
}

export type RoomStatus = 'LOBBY' | 'STARTING' | 'TRADING' | 'ROUND_OVER' | 'GAME_OVER';

export interface RoomState {
  code: string;
  name: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  targetScore: number;
  roundNumber: number;
  players: Record<string, PlayerPublic>;
  offers: Record<string, ActiveOffer>; // Public active offers: playerId -> { quantity, timestamp }
  activeCommodities: Commodity[];
  recentTrade?: {
    player1Name: string;
    player2Name: string;
    cardCount: number;
    id: string;
  } | null;
  roundWinner?: {
    playerId: string;
    nickname: string;
    commodity: Commodity;
    points: number;
    handsSummary?: Record<string, { nickname: string; hand: Card[] }>;
  } | null;
  overallWinner?: {
    playerId: string;
    nickname: string;
    score: number;
  } | null;
}

export interface ClientHandState {
  hand: Card[];
  counts: Record<string, number>;
  canClaimWin: boolean;
  winningSuit?: string;
}

// Client to Server Events
export interface ClientToServerEvents {
  'room:create': (data: { nickname: string; avatar: string; roomName?: string; targetScore?: number }, callback: (res: { success: boolean; roomCode?: string; player?: PlayerPrivate; error?: string }) => void) => void;
  'room:join': (data: { roomCode: string; nickname: string; avatar: string; playerId?: string; token?: string }, callback: (res: { success: boolean; room?: RoomState; player?: PlayerPrivate; error?: string }) => void) => void;
  'room:reconnect': (data: { roomCode: string; playerId: string; token: string }, callback: (res: { success: boolean; room?: RoomState; handState?: ClientHandState; error?: string }) => void) => void;
  'game:start': (callback: (res: { success: boolean; error?: string }) => void) => void;
  'trade:offer': (data: { cardIds: string[] }, callback: (res: { success: boolean; error?: string }) => void) => void;
  'trade:cancel': (callback: (res: { success: boolean; error?: string }) => void) => void;
  'trade:accept': (data: { targetPlayerId: string }, callback: (res: { success: boolean; error?: string }) => void) => void;
  'game:claim_win': (callback: (res: { success: boolean; error?: string }) => void) => void;
  'game:next_round': (callback: (res: { success: boolean; error?: string }) => void) => void;
  'game:reset_to_lobby': (callback: (res: { success: boolean; error?: string }) => void) => void;
  // WebRTC Voice Chat Events
  'voice:signal': (data: { toPlayerId: string; signal: any }) => void;
  'voice:status': (data: { isMuted: boolean; isSpeaking?: boolean }) => void;
}

// Server to Client Events
export interface ServerToClientEvents {
  'room:updated': (room: RoomState) => void;
  'hand:updated': (handState: ClientHandState) => void;
  'trade:executed': (trade: { player1Id: string; player1Name: string; player2Id: string; player2Name: string; count: number }) => void;
  'trade:failed': (data: { message: string }) => void;
  'round:start': (data: { roundNumber: number }) => void;
  'round:ended': (data: RoomState['roundWinner']) => void;
  'game:ended': (data: RoomState['overallWinner']) => void;
  'shout:sound': (data: { playerId: string; count: number }) => void;
  'player:disconnected': (data: { playerId: string; nickname: string }) => void;
  'player:reconnected': (data: { playerId: string; nickname: string }) => void;
  // WebRTC Voice Chat Events
  'voice:signal': (data: { fromPlayerId: string; signal: any }) => void;
  'voice:peer_joined': (data: { playerId: string }) => void;
}
