// backend/engine/PokerGame.ts
import { Card, PokerPlayer, PokerRoom } from '../types';
import * as PokerSolver from 'pokersolver';
const Hand = (PokerSolver as any).Hand;

export class PokerGame {
  state: PokerRoom;

  constructor(id: string) {
    this.state = {
      id,
      name: `Table ${id.slice(0, 4)}`,
      isPrivate: false,
      players: [],
      pot: 0,
      communityCards: [],
      phase: 'IDLE',
      activeSeat: 0,
      minBuyIn: 1000,
      messages: [],
      currentBet: 0
    };
  }

  // Hydrate from Redis data
  static fromState(data: any): PokerGame {
    const game = new PokerGame(data.id);
    game.state = { ...game.state, ...data };
    return game;
  }

  addPlayer(user: any, socketId: string) {
    if (this.state.players.find(p => p.id === user.email)) return;
    
    const newPlayer: PokerPlayer = {
      id: user.email,
      name: user.name,
      avatar: user.avatar,
      balance: user.balance, // This is the buy-in amount
      hand: [],
      bet: 0,
      isFolded: false,
      isDealer: this.state.players.length === 0,
      seat: this.state.players.length
    };
    // @ts-ignore
    newPlayer.socketId = socketId;
    this.state.players.push(newPlayer);
  }

  createDeck(): Card[] {
    const suits = ['h', 'd', 'c', 's'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const deck: Card[] = [];
    suits.forEach(s => values.forEach(v => {
      // Map to API format
      let apiVal = v === 'T' ? '10' : (v === 'J' ? 'JACK' : (v === 'Q' ? 'QUEEN' : (v === 'K' ? 'KING' : (v === 'A' ? 'ACE' : v))));
      let apiSuit = s === 'h' ? 'HEARTS' : (s === 'd' ? 'DIAMONDS' : (s === 'c' ? 'CLUBS' : 'SPADES'));
      
      deck.push({
        code: v + s,
        image: `https://deckofcardsapi.com/static/img/${v === 'T' ? '0' : v}${s.toUpperCase()}.png`,
        value: apiVal,
        suit: apiSuit
      });
    }));
    return deck.sort(() => Math.random() - 0.5);
  }

  startGame() {
    if (this.state.players.length < 2) return;
    
    const deck = this.createDeck();
    // @ts-ignore - Storing deck in state for persistence
    this.state.deck = deck;
    
    this.state.pot = 0;
    this.state.phase = 'PRE_FLOP';
    this.state.communityCards = [];
    
    // Rotate Dealer
    // @ts-ignore
    const currentDealerIdx = this.state.players.findIndex(p => p.isDealer);
    const nextDealerIdx = (currentDealerIdx + 1) % this.state.players.length;
    
    this.state.players.forEach((p, i) => {
      p.isDealer = i === nextDealerIdx;
      p.hand = [deck.pop()!, deck.pop()!];
      p.isFolded = false;
      p.bet = 0;
    });

    // Blinds
    const sb = (nextDealerIdx + 1) % this.state.players.length;
    const bb = (nextDealerIdx + 2) % this.state.players.length;
    
    this.handleBet(sb, 50); // SB
    this.handleBet(bb, 100); // BB
    
    this.state.activeSeat = (bb + 1) % this.state.players.length;
    // @ts-ignore
    this.state.minRaise = 100;
    // @ts-ignore
    this.state.lastRaiserIndex = bb;
  }

  handleBet(seatIdx: number, amount: number) {
    const p = this.state.players[seatIdx];
    const actual = Math.min(amount, p.balance);
    p.balance -= actual;
    p.bet += actual;
    this.state.pot += actual;
    if (p.bet > this.state.currentBet) this.state.currentBet = p.bet;
  }

  processAction(playerId: string, action: { type: string, amount?: number }): boolean {
    const p = this.state.players[this.state.activeSeat];
    if (p.id !== playerId) return false; // Not your turn

    if (action.type === 'FOLD') {
      p.isFolded = true;
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} folds`, timestamp: Date.now() });
    } else if (action.type === 'CHECK') {
      if (p.bet < this.state.currentBet) return false; // Cannot check
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} checks`, timestamp: Date.now() });
    } else if (action.type === 'CALL') {
      const toCall = this.state.currentBet - p.bet;
      this.handleBet(this.state.activeSeat, toCall);
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} calls`, timestamp: Date.now() });
    } else if (action.type === 'RAISE') {
      // @ts-ignore
      const min = this.state.minRaise;
      const raiseTo = action.amount || (this.state.currentBet + min);
      if (raiseTo < this.state.currentBet + min) return false;
      
      const toAdd = raiseTo - p.bet;
      this.handleBet(this.state.activeSeat, toAdd);
      // @ts-ignore
      this.state.minRaise = raiseTo - this.state.currentBet; // Update min raise
      // @ts-ignore
      this.state.lastRaiserIndex = this.state.activeSeat;
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} raises to ${raiseTo}`, timestamp: Date.now() });
    }

    this.nextTurn();
    return true;
  }

  nextTurn() {
    // Check if round should end
    const active = this.state.players.filter(p => !p.isFolded && p.balance > 0);
    const allMatched = active.every(p => p.bet === this.state.currentBet);
    
    // @ts-ignore
    if (allMatched && this.state.activeSeat === this.state.lastRaiserIndex) {
      this.advancePhase();
      return;
    }

    // Move to next player
    let next = (this.state.activeSeat + 1) % this.state.players.length;
    while (this.state.players[next].isFolded || this.state.players[next].balance === 0) {
      next = (next + 1) % this.state.players.length;
    }
    this.state.activeSeat = next;
  }

  advancePhase() {
    this.state.players.forEach(p => p.bet = 0);
    this.state.currentBet = 0;
    // @ts-ignore
    this.state.minRaise = 100;

    // @ts-ignore
    const deck = this.state.deck;

    if (this.state.phase === 'PRE_FLOP') {
      this.state.phase = 'FLOP';
      this.state.communityCards.push(deck.pop()!, deck.pop()!, deck.pop()!);
    } else if (this.state.phase === 'FLOP') {
      this.state.phase = 'TURN';
      this.state.communityCards.push(deck.pop()!);
    } else if (this.state.phase === 'TURN') {
      this.state.phase = 'RIVER';
      this.state.communityCards.push(deck.pop()!);
    } else {
      this.state.phase = 'SHOWDOWN';
      return; // Server handles winner calculation
    }

    // Reset turn to first active left of dealer
    // @ts-ignore
    const dealerIdx = this.state.players.findIndex(p => p.isDealer);
    let next = (dealerIdx + 1) % this.state.players.length;
    while (this.state.players[next].isFolded) next = (next + 1) % this.state.players.length;
    
    this.state.activeSeat = next;
    // @ts-ignore
    this.state.lastRaiserIndex = next;
  }
}