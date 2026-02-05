
import React, { useState, useEffect, useCallback } from 'react';
import { Card, GameOutcome, GameStatus } from '../types';

interface BlackjackProps {
  onGameEnd: (outcome: GameOutcome) => void;
  balance: number;
}

const Blackjack: React.FC<BlackjackProps> = ({ onGameEnd, balance }) => {
  const [deckId, setDeckId] = useState<string>('');
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYER_TURN' | 'DEALER_TURN' | 'FINISHED'>('IDLE');
  const [bet, setBet] = useState(100);
  const [isLoading, setIsLoading] = useState(false);

  const calculateScore = (hand: Card[]) => {
    let score = 0;
    let aces = 0;
    hand.forEach(card => {
      if (['KING', 'QUEEN', 'JACK'].includes(card.value)) score += 10;
      else if (card.value === 'ACE') {
        score += 11;
        aces += 1;
      } else score += parseInt(card.value);
    });
    while (score > 21 && aces > 0) {
      score -= 10;
      aces -= 1;
    }
    return score;
  };

  const initDeck = async () => {
    const res = await fetch('https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=6');
    const data = await res.json();
    setDeckId(data.deck_id);
    return data.deck_id;
  };

  const startGame = async () => {
    if (balance < bet) return;
    setIsLoading(true);
    let id = deckId;
    if (!id) id = await initDeck();

    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${id}/draw/?count=4`);
    const drawData = await drawRes.json();
    
    const pHand = [drawData.cards[0], drawData.cards[2]];
    const dHand = [drawData.cards[1], drawData.cards[3]];

    setPlayerHand(pHand);
    setDealerHand(dHand);
    setGameState('PLAYER_TURN');
    setIsLoading(false);

    if (calculateScore(pHand) === 21) {
      handleStand(pHand, dHand);
    }
  };

  const handleHit = async () => {
    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
    const drawData = await drawRes.json();
    const newHand = [...playerHand, drawData.cards[0]];
    setPlayerHand(newHand);
    
    if (calculateScore(newHand) > 21) {
      setGameState('FINISHED');
      onGameEnd({ status: GameStatus.LOST, amount: -bet, message: 'You busted!' });
    }
  };

  const handleStand = async (pHand = playerHand, dHand = dealerHand) => {
    setGameState('DEALER_TURN');
    let currentDealerHand = [...dHand];
    let dScore = calculateScore(currentDealerHand);
    const pScore = calculateScore(pHand);

    while (dScore < 17) {
      const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
      const drawData = await drawRes.json();
      currentDealerHand.push(drawData.cards[0]);
      dScore = calculateScore(currentDealerHand);
      setDealerHand([...currentDealerHand]);
    }

    setGameState('FINISHED');
    if (dScore > 21 || pScore > dScore) {
      onGameEnd({ status: GameStatus.WON, amount: bet, message: `Dealer had ${dScore}, you win!` });
    } else if (pScore < dScore) {
      onGameEnd({ status: GameStatus.LOST, amount: -bet, message: `Dealer had ${dScore}, you lose.` });
    } else {
      onGameEnd({ status: GameStatus.DRAW, amount: 0, message: 'Push!' });
    }
  };

  const handleDoubleDown = async () => {
    if (balance < bet * 2) return;
    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
    const drawData = await drawRes.json();
    const newHand = [...playerHand, drawData.cards[0]];
    setPlayerHand(newHand);
    const oldBet = bet;
    setBet(oldBet * 2);

    if (calculateScore(newHand) > 21) {
      setGameState('FINISHED');
      onGameEnd({ status: GameStatus.LOST, amount: -oldBet * 2, message: 'Busted on double down!' });
    } else {
      handleStand(newHand);
    }
  };

  const renderCard = (card: Card, hidden = false) => (
    <div className={`relative w-24 h-36 md:w-32 md:h-48 rounded-lg overflow-hidden border-2 border-luxury-gold/30 shadow-2xl transition-all duration-500 transform ${hidden ? 'rotate-y-180' : ''}`}>
      {hidden ? (
        <div className="w-full h-full bg-luxury-gold bg-[radial-gradient(circle_at_center,_#996515_0%,_#d4af37_100%)] flex items-center justify-center p-4">
          <div className="w-full h-full border border-white/20 rounded flex items-center justify-center font-cinzel text-luxury-black text-4xl font-bold opacity-40">V</div>
        </div>
      ) : (
        <img src={card.image} alt={card.code} className="w-full h-full object-cover" />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-8 select-none">
      <div className="flex flex-col gap-4">
        <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold text-center">Dealer Hand ({gameState === 'PLAYER_TURN' ? '?' : calculateScore(dealerHand)})</h3>
        <div className="flex justify-center gap-4 min-h-[144px] md:min-h-[192px]">
          {dealerHand.map((card, i) => renderCard(card, i === 1 && gameState === 'PLAYER_TURN'))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold text-center">Your Hand ({calculateScore(playerHand)})</h3>
        <div className="flex justify-center gap-4 min-h-[144px] md:min-h-[192px]">
          {playerHand.map(card => renderCard(card))}
        </div>
      </div>

      <div className="bg-[#0f0f0f] p-6 rounded-2xl border border-luxury-gold/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Bet Amount</label>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              value={bet} 
              onChange={(e) => setBet(Math.max(10, parseInt(e.target.value) || 0))}
              disabled={gameState !== 'IDLE' && gameState !== 'FINISHED'}
              className="bg-black border border-luxury-gold/40 text-luxury-gold px-4 py-2 rounded-lg w-32 font-bold focus:outline-none focus:ring-1 focus:ring-luxury-gold"
            />
            <div className="flex gap-1">
              {[10, 100, 500, 1000].map(val => (
                <button 
                  key={val} 
                  onClick={() => setBet(val)}
                  disabled={gameState !== 'IDLE' && gameState !== 'FINISHED'}
                  className="px-2 py-1 text-[10px] border border-luxury-gold/20 rounded hover:bg-luxury-gold/10 transition-colors"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {gameState === 'IDLE' || gameState === 'FINISHED' ? (
            <button 
              onClick={startGame} 
              disabled={isLoading}
              className="px-12 py-3 bg-luxury-gold text-luxury-black font-cinzel font-bold text-lg rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg gold-glow"
            >
              DEAL HAND
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleHit} 
                className="px-8 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/10"
              >
                HIT
              </button>
              <button 
                onClick={() => handleStand()} 
                className="px-8 py-3 bg-luxury-gold text-luxury-black font-bold rounded-xl hover:brightness-110 transition-all"
              >
                STAND
              </button>
              {playerHand.length === 2 && (
                <button 
                  onClick={handleDoubleDown} 
                  className="px-8 py-3 border border-luxury-gold text-luxury-gold font-bold rounded-xl hover:bg-luxury-gold/10 transition-all"
                >
                  DOUBLE
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Blackjack;
