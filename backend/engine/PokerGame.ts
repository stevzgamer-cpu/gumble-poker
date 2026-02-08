import { Card, PokerPlayer, PokerRoom } from '../types';
import * as PokerSolver from 'pokersolver';
const Hand = (PokerSolver as any).Hand;

export class PokerGame {
  state: PokerRoom;
  // [NEW] Track who acted this round to prevent "Skipping"
  playersActed: Set<string>; 

  constructor(id: string) {
    this.playersActed = new Set();
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

  static fromState(data: any): PokerGame {
    const game = new PokerGame(data.id);
    game.state = { ...game.state, ...data };
    // We re-hydrate the set from the array saved in Redis (if any)
    game.playersActed = new Set(data.playersActed || []);
    return game;
  }

  // Need to save the Set as an array for Redis
  toState() {
    return {
      ...this.state,
      playersActed: Array.from(this.playersActed)
    };
  }

  addPlayer(user: any, socketId: string) {
    if (this.state.players.find(p => p.id === user.email)) return;
    
    const newPlayer: PokerPlayer = {
      id: user.email,
      name: user.name,
      avatar: user.avatar,
      balance: user.balance, 
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
    const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'];
    const deck: Card[] = [];
    suits.forEach(suit => {
      values.forEach(value => {
        deck.push({
          code: `${value === '10' ? '10' : value[0]}${suit[0]}`,
          image: `https://deckofcardsapi.com/static/img/${value === '10' ? '0' : value[0]}${suit[0]}.png`,
          value,
          suit
        });
      });
    });
    return deck.sort(() => Math.random() - 0.5);
  }

  startGame() {
    if (this.state.players.length < 2) return;
    
    const deck = this.createDeck();
    // @ts-ignore
    this.state.deck = deck;
    
    this.state.pot = 0;
    this.state.phase = 'PRE_FLOP';
    this.state.communityCards = [];
    this.playersActed.clear();
    
    // Rotate Dealer
    // @ts-ignore
    const currentDealerIdx = this.state.players.findIndex(p => p.isDealer);
    const nextDealerIdx = (currentDealerIdx === -1) ? 0 : (currentDealerIdx + 1) % this.state.players.length;
    
    this.state.players.forEach((p, i) => {
      p.isDealer = i === nextDealerIdx;
      p.hand = [deck.pop()!, deck.pop()!];
      p.isFolded = false;
      p.bet = 0;
    });

    // Blinds Logic
    const sb = (nextDealerIdx + 1) % this.state.players.length;
    const bb = (nextDealerIdx + 2) % this.state.players.length;
    
    this.handleBet(sb, 50); 
    this.handleBet(bb, 100); 
    
    // UTG starts (Left of Big Blind)
    this.state.activeSeat = (bb + 1) % this.state.players.length;
    
    // @ts-ignore
    this.state.minRaise = 100;
    this.state.currentBet = 100;
  }

  handleBet(seatIdx: number, amount: number) {
    const p = this.state.players[seatIdx];
    const actual = Math.min(amount, p.balance);
    p.balance -= actual;
    p.bet += actual;
    this.state.pot += actual;
    // Don't update currentBet here, it is controlled by Raise logic
  }

  processAction(playerId: string, action: { type: string, amount?: number }): boolean {
    const p = this.state.players[this.state.activeSeat];
    if (p.id !== playerId) return false; 

    // 1. Handle the Action
    if (action.type === 'FOLD') {
      p.isFolded = true;
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} folds`, timestamp: Date.now() });
    } else if (action.type === 'CHECK') {
      if (p.bet < this.state.currentBet) return false; // Illegal check
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} checks`, timestamp: Date.now() });
    } else if (action.type === 'CALL') {
      const toCall = this.state.currentBet - p.bet;
      this.handleBet(this.state.activeSeat, toCall);
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} calls`, timestamp: Date.now() });
    } else if (action.type === 'RAISE') {
      // @ts-ignore
      const min = this.state.minRaise || 100;
      const raiseTo = action.amount || (this.state.currentBet + min);
      if (raiseTo < this.state.currentBet + min) return false;
      
      const toAdd = raiseTo - p.bet;
      this.handleBet(this.state.activeSeat, toAdd);
      
      // @ts-ignore
      this.state.minRaise = raiseTo - this.state.currentBet;
      this.state.currentBet = raiseTo;
      
      // [IMPORTANT] When someone raises, everyone else must act again
      this.playersActed.clear(); 
      this.state.messages.push({ user: 'SYSTEM', text: `${p.name} raises to ${raiseTo}`, timestamp: Date.now() });
    }

    // 2. Mark this player as having acted
    this.playersActed.add(p.id);

    // 3. Move Turn
    this.nextTurn();
    return true;
  }

  nextTurn() {
    // [CRITICAL FIX] The "Skipping" logic was broken. Here is the real Poker logic:
    const activePlayers = this.state.players.filter(p => !p.isFolded && p.balance > 0);
    
    // Round is over ONLY if:
    // 1. Everyone active has acted
    // 2. Everyone's bet matches the current high bet
    const allActed = activePlayers.every(p => this.playersActed.has(p.id));
    const allMatched = activePlayers.every(p => p.bet === this.state.currentBet);

    if (allActed && allMatched) {
        this.advancePhase();
        return;
    }

    // Find next non-folded player
    let next = (this.state.activeSeat + 1) % this.state.players.length;
    while (this.state.players[next].isFolded || this.state.players[next].balance === 0) {
      next = (next + 1) % this.state.players.length;
    }
    this.state.activeSeat = next;
  }

  advancePhase() {
    // Reset for next betting round
    this.state.players.forEach(p => p.bet = 0);
    this.state.currentBet = 0;
    this.playersActed.clear();
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
      return; 
    }

    // After phase change, turn goes to the first active player left of Dealer
    // @ts-ignore
    const dealerIdx = this.state.players.findIndex(p => p.isDealer);
    let next = (dealerIdx + 1) % this.state.players.length;
    while (this.state.players[next].isFolded || this.state.players[next].balance === 0) {
        next = (next + 1) % this.state.players.length;
    }
    
    this.state.activeSeat = next;
  }
}