
import React, { useState } from 'react';
import { GameOutcome, GameStatus } from '../types';

interface KenoProps {
  onGameEnd: (outcome: GameOutcome) => void;
  balance: number;
}

const Keno: React.FC<KenoProps> = ({ onGameEnd, balance }) => {
  const [bet, setBet] = useState(100);
  const [selected, setSelected] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // Classic Keno Payouts (Pick 10)
  const payouts: { [matches: number]: number } = {
    0: 0, 1: 0, 2: 0, 3: 1, 4: 2, 5: 5, 6: 15, 7: 50, 8: 200, 9: 1000, 10: 10000
  };

  const handleSelect = (num: number) => {
    if (isPlaying) return;
    if (selected.includes(num)) {
      setSelected(selected.filter(n => n !== num));
    } else if (selected.length < 10) {
      setSelected([...selected, num]);
    }
  };

  const startGame = async () => {
    if (balance < bet || selected.length === 0) return;
    setIsPlaying(true);
    setDrawn([]);

    // Draw 10 random unique numbers
    const draw: number[] = [];
    while (draw.length < 10) {
      const n = Math.floor(Math.random() * 40) + 1;
      if (!draw.includes(n)) {
        draw.push(n);
        // Step animation effect
        await new Promise(r => setTimeout(r, 150));
        setDrawn([...draw]);
      }
    }

    const matches = selected.filter(n => draw.includes(n)).length;
    const mult = payouts[matches] || 0;
    const winAmount = Math.floor(bet * (mult - 1));

    setTimeout(() => {
      if (mult > 0) {
        onGameEnd({ status: GameStatus.WON, amount: winAmount, message: `Matched ${matches} numbers!` });
      } else {
        onGameEnd({ status: GameStatus.LOST, amount: -bet, message: `Matched ${matches}. Better luck next time!` });
      }
      setIsPlaying(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col md:flex-row gap-12 items-start justify-center p-4">
      <div className="w-full md:w-80 bg-[#121212] rounded-2xl p-6 border border-luxury-gold/20 flex flex-col gap-6 shadow-2xl">
        <h3 className="font-cinzel text-2xl text-luxury-gold text-center">Keno VIP</h3>
        
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 block">Bet</label>
          <input 
            type="number" 
            value={bet} 
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 0))}
            disabled={isPlaying}
            className="w-full bg-black border border-luxury-gold/40 text-luxury-gold px-4 py-3 rounded-lg font-bold"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block">Selection ({selected.length}/10)</label>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className={`flex-1 min-w-[30px] p-1 rounded border text-[8px] text-center font-bold ${selected.length === i ? 'border-luxury-gold text-luxury-gold' : 'border-white/5 text-gray-700'}`}>
                {i} Match: {payouts[i]}x
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={startGame} 
          disabled={isPlaying || selected.length === 0}
          className="w-full py-4 bg-luxury-gold text-luxury-black font-cinzel font-bold text-xl rounded-xl shadow-lg disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
        >
          {isPlaying ? 'DRAWING...' : 'PLACE BET'}
        </button>
      </div>

      <div className="grid grid-cols-8 gap-2 p-6 bg-luxury-black rounded-3xl border border-luxury-gold/10 shadow-inner">
        {Array.from({ length: 40 }).map((_, i) => {
          const num = i + 1;
          const isSelected = selected.includes(num);
          const isDrawn = drawn.includes(num);
          const isMatch = isSelected && isDrawn;

          return (
            <button
              key={num}
              onClick={() => handleSelect(num)}
              disabled={isPlaying}
              className={`w-10 h-10 md:w-14 md:h-14 rounded-lg text-sm font-bold transition-all duration-300 transform
                ${isMatch ? 'bg-luxury-gold text-luxury-black scale-110 shadow-[0_0_15px_#d4af37]' : 
                  isDrawn ? 'bg-white/20 text-white' : 
                  isSelected ? 'border-2 border-luxury-gold text-luxury-gold bg-luxury-gold/5' : 
                  'bg-[#222] text-gray-500 border border-white/5 hover:border-luxury-gold/30 hover:text-white'}
              `}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Keno;
