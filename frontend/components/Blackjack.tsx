import React, { useState, useEffect } from 'react';
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
    let id = deckId;
    if (!id) id = await initDeck();

    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${id}/draw/?count=4`);
    const drawData = await drawRes.json();
    
    const pHand = [drawData.cards[0], drawData.cards[2]];
    const dHand = [drawData.cards[1], drawData.cards[3]];

    setPlayerHand(pHand);
    setDealerHand(dHand);
    setIsLoading(false);

    const pScore = calculateScore(pHand);
    
    if (pScore === 21) {
      setGameState('FINISHED');
      onGameEnd({ status: GameStatus.WON, amount: Math.floor(finalBet * 1.5), message: 'BLACKJACK! Natural 21!' });
      return;
    }

    if (dHand[0].value === 'ACE') {
      setGameState('INSURANCE');
    } else {
      setGameState('PLAYER_TURN');
    }
  };

  const handleInsurance = (take: boolean) => {
    if (take) {
      const insAmount = bet / 2;
      if (balance < bet + insAmount) return;
      setInsuranceBet(insAmount);
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
      onGameEnd({ status: GameStatus.LOST, amount: -bet - insuranceBet, message: 'Bust!' });
    }
  };

  const handleStand = async (pHand = playerHand, dHand = dealerHand) => {
    setGameState('DEALER_TURN');
    let currentDealerHand = [...dHand];
    let dScore = calculateScore(currentDealerHand);
    const pScore = calculateScore(pHand);

    // Insurance check
    const isDealerBlackjack = dScore === 21 && currentDealerHand.length === 2;
    let netInsuranceResult = 0;
    if (insuranceBet > 0) {
      netInsuranceResult = isDealerBlackjack ? insuranceBet * 2 : -insuranceBet;
    }

    while (dScore < 17) {
      await new Promise(r => setTimeout(r, 800)); // Delay for suspense
      const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
      const drawData = await drawRes.json();
      currentDealerHand.push(drawData.cards[0]);
      dScore = calculateScore(currentDealerHand);
      setDealerHand([...currentDealerHand]);
    }

    setGameState('FINISHED');
    if (dScore > 21 || pScore > dScore) {
      onGameEnd({ status: GameStatus.WON, amount: bet + netInsuranceResult, message: `Dealer ${dScore}, You Win!` });
    } else if (pScore < dScore) {
      onGameEnd({ status: GameStatus.LOST, amount: -bet + netInsuranceResult, message: `Dealer ${dScore}, You Lose.` });
    } else {
      onGameEnd({ status: GameStatus.DRAW, amount: netInsuranceResult, message: 'Push.' });
    }
  };

  const handleDoubleDown = async () => {
    if (balance < (bet * 2) + insuranceBet) return;
    const drawRes = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
    const drawData = await drawRes.json();
    const newHand = [...playerHand, drawData.cards[0]];
    setPlayerHand(newHand);
    const oldBet = bet;
    setBet(oldBet * 2);

    if (calculateScore(newHand) > 21) {
      setGameState('FINISHED');
      onGameEnd({ status: GameStatus.LOST, amount: -(oldBet * 2) - insuranceBet, message: 'Busted on Double!' });
    } else {
      handleStand(newHand);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 lg:p-8 bg-[#0a0a0a] overflow-hidden">
      
      {/* Table Container */}
      <div className="relative w-full max-w-6xl aspect-video bg-[#1a1a1a] rounded-[30px] lg:rounded-[100px] border-4 lg:border-8 border-luxury-gold/20 shadow-2xl flex items-center justify-center select-none">
        
        {/* Felt */}
        <div className="absolute inset-2 lg:inset-4 rounded-[25px] lg:rounded-[90px] bg-[#0f3a20] shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-30 pointer-events-none" />
           
           {/* Logo */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
              <h1 className="font-cinzel text-[8vw] text-white font-bold tracking-tighter">BLACKJACK</h1>
           </div>
        </div>

        {/* Dealer Hand (Top) */}
        <div className="absolute top-[15%] flex flex-col items-center gap-2 z-10">
           <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
             Dealer {gameState !== 'IDLE' && `(${gameState === 'PLAYER_TURN' ? '?' : calculateScore(dealerHand)})`}
           </span>
           <div className="flex gap-2">
              {dealerHand.map((card, i) => (
                <div key={i} className="w-[6vw] lg:w-[4vw] aspect-[2/3] bg-white rounded shadow-xl relative">
                   {(i === 1 && gameState === 'PLAYER_TURN') ? (
                     <div className="w-full h-full bg-luxury-gold border border-white/20 rounded flex items-center justify-center">
                       <span className="text-black font-cinzel font-bold">V</span>
                     </div>
                   ) : (
                     <img src={card.image} className="w-full h-full object-cover rounded" />
                   )}
                </div>
              ))}
              {dealerHand.length === 0 && <div className="w-[6vw] lg:w-[4vw] aspect-[2/3] border border-white/10 rounded bg-black/20" />}
           </div>
        </div>

        {/* Player Hand (Bottom) */}
        <div className="absolute bottom-[25%] flex flex-col items-center gap-2 z-10">
           <div className="flex gap-2">
              {playerHand.map((card, i) => (
                <div key={i} className="w-[7vw] lg:w-[5vw] aspect-[2/3] bg-white rounded shadow-2xl animate-in slide-in-from-bottom-4">
                   <img src={card.image} className="w-full h-full object-cover rounded" />
                </div>
              ))}
              {playerHand.length === 0 && <div className="w-[7vw] lg:w-[5vw] aspect-[2/3] border border-white/10 rounded bg-black/20" />}
           </div>
           <span className="text-[10px] text-luxury-gold font-bold tracking-widest uppercase bg-black/50 px-3 py-1 rounded-full">
             You {gameState !== 'IDLE' && `(${calculateScore(playerHand)})`}
           </span>
        </div>

        {/* Game Controls (Floating) */}
        {gameState === 'PLAYER_TURN' && (
           <div className="absolute bottom-[8%] flex gap-4 z-20">
              <button onClick={handleHit} className="px-8 py-3 bg-luxury-gold text-black font-black rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all text-sm uppercase">HIT</button>
              <button onClick={() => handleStand()} className="px-8 py-3 bg-white/10 text-white font-black rounded-xl border border-white/20 hover:bg-white/20 active:scale-95 transition-all text-sm uppercase">STAND</button>
              {playerHand.length === 2 && (
                <button onClick={handleDoubleDown} className="px-8 py-3 bg-black/50 text-luxury-gold border border-luxury-gold font-black rounded-xl hover:bg-black/70 active:scale-95 transition-all text-sm uppercase">DOUBLE</button>
              )}
           </div>
        )}

        {/* Insurance Overlay */}
        {gameState === 'INSURANCE' && (
           <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-luxury-gold flex flex-col items-center gap-4 shadow-2xl">
                 <h2 className="text-luxury-gold font-cinzel text-xl">Insurance?</h2>
                 <p className="text-gray-400 text-xs">Cost: ${bet/2}</p>
                 <div className="flex gap-4">
                    <button onClick={() => handleInsurance(true)} className="px-6 py-2 bg-luxury-gold text-black font-bold rounded">YES</button>
                    <button onClick={() => handleInsurance(false)} className="px-6 py-2 border border-white/20 text-white font-bold rounded">NO</button>
                 </div>
              </div>
           </div>
        )}

        {/* Start / Idle Screen */}
        {(gameState === 'IDLE' || gameState === 'FINISHED') && (
           <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-6">
              {/* Betting Controls */}
              <div className="bg-[#0a0a0a] p-6 rounded-[24px] border border-luxury-gold/30 flex flex-col items-center gap-4 shadow-2xl">
                 <div className="text-luxury-gold font-cinzel text-lg">PLACE BET</div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setBet(Math.max(10, bet - 10))} className="w-8 h-8 rounded bg-white/5 text-white hover:bg-white/10">-</button>
                    <input 
                      type="number" 
                      value={betInput} 
                      onChange={(e) => { setBetInput(e.target.value); setBet(parseInt(e.target.value)||0); }}
                      className="bg-black border border-white/10 rounded px-4 py-2 text-center text-white w-32 focus:border-luxury-gold outline-none font-mono"
                    />
                    <button onClick={() => setBet(bet + 10)} className="w-8 h-8 rounded bg-white/5 text-white hover:bg-white/10">+</button>
                 </div>
                 <button onClick={startGame} disabled={isLoading} className="w-full py-3 bg-luxury-gold text-black font-bold rounded-xl hover:brightness-110 shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all uppercase tracking-widest">
                    DEAL CARDS
                 </button>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default Blackjack;