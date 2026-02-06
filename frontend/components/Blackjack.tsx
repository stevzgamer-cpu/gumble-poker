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
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYER_TURN' | 'DEALER_TURN' | 'FINISHED' | 'INSURANCE'>('IDLE');
  const [bet, setBet] = useState(100);
  const [betInput, setBetInput] = useState('100');
  const [isLoading, setIsLoading] = useState(false);
  const [insuranceBet, setInsuranceBet] = useState(0);

  const calculateScore = (hand: Card[]) => {
    let score = 0;
    let aces = 0;
    hand.forEach(card => {
      if (['KING', 'QUEEN', 'JACK'].includes(card.value)) score += 10;
      else if (card.value === 'ACE') {
        score += 11;
        aces += 1;
      } else {
        const val = parseInt(card.value);
        score += isNaN(val) ? 10 : val;
      }
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
    const finalBet = Math.max(10, parseInt(betInput) || 0);
    if (balance < finalBet) {
      alert("Insufficient balance.");
      return;
    }
    setBet(finalBet);
    setInsuranceBet(0);
    setIsLoading(true);
    let id = deckId || await initDeck();

    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${id}/draw/?count=4`);
    const drawData = await drawRes.json();
    
    const pHand = [drawData.cards[0], drawData.cards[2]];
    const dHand = [drawData.cards[1], drawData.cards[3]];

    setPlayerHand(pHand);
    setDealerHand(dHand);
    setIsLoading(false);

    const pScore = calculateScore(pHand);
    const dScore = calculateScore(dHand);

    // Natural 21 Check
    if (pScore === 21) {
      setGameState('FINISHED');
      if (dScore === 21) {
        onGameEnd({ status: GameStatus.DRAW, amount: 0, message: 'Both have Blackjack! Push.' });
      } else {
        onGameEnd({ status: GameStatus.WON, amount: Math.floor(finalBet * 1.5), message: 'BLACKJACK! Natural 21!' });
      }
      return;
    }

    // Insurance Offer if Dealer shows Ace
    if (dHand[0].value === 'ACE') {
      setGameState('INSURANCE');
    } else {
      setGameState('PLAYER_TURN');
    }
  };

  const handleInsurance = (take: boolean) => {
    if (take) {
      const ins = bet / 2;
      if (balance < bet + ins) {
        alert("Insufficient balance for insurance.");
        setGameState('PLAYER_TURN');
        return;
      }
      setInsuranceBet(ins);
    }
    setGameState('PLAYER_TURN');
  };

  const handleHit = async () => {
    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
    const drawData = await drawRes.json();
    const newHand = [...playerHand, drawData.cards[0]];
    setPlayerHand(newHand);
    
    if (calculateScore(newHand) > 21) {
      setGameState('FINISHED');
      onGameEnd({ status: GameStatus.LOST, amount: -bet - insuranceBet, message: 'Busted!' });
    }
  };

  const handleStand = async (finalPHand = playerHand) => {
    setGameState('DEALER_TURN');
    let currentDHand = [...dealerHand];
    let dScore = calculateScore(currentDHand);
    const pScore = calculateScore(finalPHand);

    // Dealer Blackjack Check for Insurance
    const isDealerBJ = dScore === 21 && currentDHand.length === 2;
    let insResult = 0;
    if (insuranceBet > 0) {
      insResult = isDealerBJ ? insuranceBet * 2 : -insuranceBet;
    }

    while (dScore < 17) {
      const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
      const drawData = await drawRes.json();
      currentDHand.push(drawData.cards[0]);
      dScore = calculateScore(currentDHand);
      setDealerHand([...currentDHand]);
    }

    setGameState('FINISHED');
    if (dScore > 21 || pScore > dScore) {
      onGameEnd({ status: GameStatus.WON, amount: bet + insResult, message: `Dealer had ${dScore}, you win!` });
    } else if (pScore < dScore) {
      onGameEnd({ status: GameStatus.LOST, amount: -bet + insResult, message: `Dealer had ${dScore}, you lose.` });
    } else {
      onGameEnd({ status: GameStatus.DRAW, amount: insResult, message: 'Push!' });
    }
  };

  const handleDouble = async () => {
    if (balance < (bet * 2) + insuranceBet) return;
    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
    const drawData = await drawRes.json();
    const newHand = [...playerHand, drawData.cards[0]];
    setPlayerHand(newHand);
    setBet(bet * 2);
    if (calculateScore(newHand) > 21) {
      setGameState('FINISHED');
      onGameEnd({ status: GameStatus.LOST, amount: -(bet * 2) - insuranceBet, message: 'Busted!' });
    } else {
      handleStand(newHand);
    }
  };

  const renderCard = (card: Card, hidden = false) => (
    <div className={`relative w-16 h-24 md:w-28 md:h-40 rounded-lg overflow-hidden border border-luxury-gold/30 shadow-xl transition-all duration-500 transform ${hidden ? 'rotate-y-180' : ''}`}>
      {hidden ? (
        <div className="w-full h-full bg-luxury-gold bg-[radial-gradient(circle_at_center,_#996515_0%,_#d4af37_100%)] flex items-center justify-center">
          <div className="w-full h-full border border-white/10 m-1 rounded flex items-center justify-center font-cinzel text-luxury-black text-2xl opacity-30">VIP</div>
        </div>
      ) : (
        <img src={card.image} alt={card.code} className="w-full h-full object-cover" />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-black text-center">Dealer: {gameState === 'PLAYER_TURN' || gameState === 'INSURANCE' ? '?' : calculateScore(dealerHand)}</p>
        <div className="flex justify-center gap-2 md:gap-4 h-24 md:h-40">
          {dealerHand.map((c, i) => renderCard(c, i === 1 && (gameState === 'PLAYER_TURN' || gameState === 'INSURANCE')))}
        </div>
      </div>

      {gameState === 'INSURANCE' && (
        <div className="bg-luxury-gold/5 border border-luxury-gold/30 p-6 rounded-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in">
          <p className="text-luxury-gold font-cinzel text-lg font-bold uppercase tracking-widest">Insurance Offered</p>
          <p className="text-white/40 text-[10px] text-center uppercase tracking-wider">Dealer shows an Ace. Bet ${bet / 2} for 2:1 payout if dealer has Blackjack.</p>
          <div className="flex gap-4 w-full max-w-xs">
            <button onClick={() => handleInsurance(true)} className="flex-1 py-3 bg-luxury-gold text-luxury-black font-bold rounded-xl hover:brightness-110">YES</button>
            <button onClick={() => handleInsurance(false)} className="flex-1 py-3 border border-luxury-gold text-luxury-gold font-bold rounded-xl hover:bg-luxury-gold/10">NO</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-black text-center">Player: {calculateScore(playerHand)}</p>
        <div className="flex justify-center gap-2 md:gap-4 h-24 md:h-40">
          {playerHand.map(c => renderCard(c))}
        </div>
      </div>

      <div className="bg-[#0a0a0a] p-4 md:p-8 rounded-[32px] border border-white/5 shadow-2xl flex flex-col items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6 w-full justify-between">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <label className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Wager</label>
            <div className="flex items-center gap-2">
              <input 
                type="number" value={betInput} onChange={e => setBetInput(e.target.value)}
                disabled={gameState !== 'IDLE' && gameState !== 'FINISHED'}
                className="bg-black border border-luxury-gold/40 text-luxury-gold px-4 py-3 rounded-xl w-full md:w-32 font-bold focus:outline-none"
              />
              <div className="flex gap-1">
                {[50, 100, 500].map(v => (
                  <button key={v} onClick={() => setBetInput(v.toString())} disabled={gameState !== 'IDLE' && gameState !== 'FINISHED'} className="px-2 py-3 text-[10px] bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 font-bold">+{v}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            {gameState === 'IDLE' || gameState === 'FINISHED' ? (
              <button onClick={startGame} disabled={isLoading} className="flex-1 md:px-12 py-4 bg-luxury-gold text-luxury-black font-cinzel font-bold text-lg rounded-2xl shadow-lg gold-glow hover:scale-105 transition-all">DEAL</button>
            ) : gameState === 'PLAYER_TURN' ? (
              <div className="flex gap-2 w-full">
                <button onClick={handleHit} className="flex-1 md:px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10">HIT</button>
                <button onClick={() => handleStand()} className="flex-1 md:px-8 py-4 bg-luxury-gold text-luxury-black font-bold rounded-xl hover:brightness-110">STAND</button>
                {playerHand.length === 2 && <button onClick={handleDouble} className="flex-1 md:px-8 py-4 border border-luxury-gold text-luxury-gold font-bold rounded-xl hover:bg-luxury-gold/5">DOUBLE</button>}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Blackjack;