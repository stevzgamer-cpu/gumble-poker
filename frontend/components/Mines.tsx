import React, { useState, useMemo } from 'react';
import { GameOutcome, GameStatus } from '../types';

interface MinesProps {
  onGameEnd: (outcome: GameOutcome) => void;
  balance: number;
}

const Mines: React.FC<MinesProps> = ({ onGameEnd, balance }) => {
  const [bet, setBet] = useState(100);
  const [minesCount, setMinesCount] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [minesIndices, setMinesIndices] = useState<number[]>([]);
  const [gameOver, setGameOver] = useState(false);

  const multiplier = useMemo(() => {
    if (revealed.length === 0) return 0;
    const calculateMinesMultiplier = (tiles: number, mines: number, picked: number) => {
      let result = 1.0;
      for (let i = 0; i < picked; i++) result *= (tiles - i) / (tiles - mines - i);
      return parseFloat((result * 0.99).toFixed(2));
    };
    return calculateMinesMultiplier(25, minesCount, revealed.length);
  }, [revealed, minesCount]);

  const startGame = () => {
    if (balance < bet) return;
    const newMines: number[] = [];
    while (newMines.length < minesCount) {
      const idx = Math.floor(Math.random() * 25);
      if (!newMines.includes(idx)) newMines.push(idx);
    }
    setMinesIndices(newMines);
    setRevealed([]);
    setGameOver(false);
    setIsPlaying(true);
  };

  const handleTileClick = (idx: number) => {
    if (!isPlaying || revealed.includes(idx) || gameOver) return;
    if (minesIndices.includes(idx)) {
      setGameOver(true);
      setIsPlaying(false);
      onGameEnd({ status: GameStatus.LOST, amount: -bet, message: 'Boom! Mine Hit.' });
    } else {
      const newRevealed = [...revealed, idx];
      setRevealed(newRevealed);
      if (newRevealed.length === 25 - minesCount) handleCashout();
    }
  };

  const handleCashout = () => {
    if (!isPlaying || revealed.length === 0) return;
    const finalMultiplier = multiplier;
    const winAmount = Math.floor(bet * (finalMultiplier - 1));
    setIsPlaying(false);
    setGameOver(true);
    onGameEnd({ status: GameStatus.WON, amount: winAmount, message: `Cashed out: $${winAmount.toLocaleString()}` });
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-8 p-4 lg:p-12 w-full max-w-6xl mx-auto h-full">
      
      {/* Controls Sidebar */}
      <div className="w-full lg:w-80 bg-[#0a0a0a] border border-luxury-gold/20 rounded-[32px] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-luxury-gold to-transparent opacity-50" />
         
         <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Bet Amount</label>
            <input type="number" value={bet} onChange={(e) => setBet(Number(e.target.value))} disabled={isPlaying} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-luxury-gold outline-none" />
         </div>

         <div>
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Mines (1-24)</label>
            <div className="flex items-center gap-4">
               <input type="range" min="1" max="24" value={minesCount} onChange={(e) => setMinesCount(Number(e.target.value))} disabled={isPlaying} className="flex-1 accent-luxury-gold h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
               <span className="text-luxury-gold font-bold">{minesCount}</span>
            </div>
         </div>

         {isPlaying ? (
            <button onClick={handleCashout} disabled={revealed.length === 0} className="w-full py-4 bg-green-600 text-white font-cinzel font-black text-xl rounded-xl shadow-lg hover:brightness-110 transition-all flex flex-col items-center">
               <span>CASHOUT</span>
               <span className="text-xs opacity-80">${(bet * multiplier).toFixed(0)} ({multiplier}x)</span>
            </button>
         ) : (
            <button onClick={startGame} className="w-full py-4 bg-luxury-gold text-black font-cinzel font-black text-xl rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:scale-105 transition-all">START</button>
         )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-3 p-4 bg-black/40 rounded-[32px] border border-white/5 backdrop-blur-sm shadow-2xl">
         {Array.from({ length: 25 }).map((_, i) => {
            const isRevealed = revealed.includes(i);
            const isMine = minesIndices.includes(i);
            const showMine = gameOver && isMine;
            const isLostMine = showMine && !isRevealed && isPlaying === false; // The mine that killed you

            return (
               <button
                  key={i}
                  onClick={() => handleTileClick(i)}
                  disabled={!isPlaying || isRevealed}
                  className={`
                     w-12 h-12 md:w-20 md:h-20 rounded-xl transition-all duration-300 flex items-center justify-center text-2xl
                     ${isRevealed 
                        ? 'bg-[#0f0f0f] border border-luxury-gold/50 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]' 
                        : showMine 
                           ? 'bg-red-900/80 border border-red-500 scale-90'
                           : 'bg-[#1a1a1a] hover:bg-[#252525] border border-white/10 shadow-lg hover:-translate-y-1'
                     }
                  `}
               >
                  {isRevealed && <span className="animate-in zoom-in duration-300">💎</span>}
                  {showMine && <span className="animate-in zoom-in duration-300">💣</span>}
               </button>
            );
         })}
      </div>

    </div>
  );
};

export default Mines;