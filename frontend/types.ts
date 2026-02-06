
export enum GameType {
  BLACKJACK = 'BLACKJACK',
  MINES = 'MINES',
  DRAGON_TOWER = 'DRAGON_TOWER',
  KENO = 'KENO',
  POKER = 'POKER'
}

export interface User {
  name: string;
  email: string;
  avatar: string;
  balance: number;
}

export interface Card {
  code: string;
  image: string;
  value: string;
  suit: string;
}

export interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  DRAW = 'DRAW'
}

export interface GameOutcome {
  status: GameStatus;
  amount: number;
  message: string;
}

export interface PokerPlayer {
  id: string;
  name: string;
  avatar: string;
  balance: number;
  hand: Card[];
  bet: number;
  isFolded: boolean;
  isDealer: boolean;
  seat: number;
}

export interface PokerRoom {
  id: string;
  name: string;
  isPrivate: boolean;
  players: PokerPlayer[];
  pot: number;
  communityCards: Card[];
  phase: 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'IDLE';
  activeSeat: number;
  minBuyIn: number;
  messages: ChatMessage[];
  /* Added currentBet to PokerRoom interface to resolve property access error in components/Poker.tsx */
  currentBet: number;