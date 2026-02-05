
import React, { useState, useCallback, useMemo } from 'react';
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
      for (let i = 0; i < picked; i++) {
        result *= (tiles - i) / (tiles - mines - i);
      }
      return parseFloat((result * 0.99).toFixed(2)); // 1% house edge
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
      onGameEnd({ status: GameStatus.LOST, amount: -bet, message: 'Boom! You hit a mine.' });
    } else {
      const newRevealed = [...revealed, idx];
      setRevealed(newRevealed);
      if (newRevealed.length === 25 - minesCount) {
        // Automatic win if all gems found
        handleCashout(newRevealed.length);
      }
    }
  };

  const handleCashout = (overrideRevealedCount?: number) => {
    if (!isPlaying || revealed.length === 0) return;
    
    // Re-calculating to ensure accuracy at moment of cashout
    const finalMultiplier = multiplier;
    const winAmount = Math.floor(bet * (finalMultiplier - 1));
    
    setIsPlaying(false);
    setGameOver(true);
    onGameEnd({ status: GameStatus.WON, amount: winAmount, message: `Successfully cashed out at ${finalMultiplier}x!` });
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start justify-center p-4">
      {/* Settings Panel */}
      <div className="w-full md:w-80 bg-[#121212] rounded-2xl p-6 border border-luxury-gold/20 flex flex-col gap-6 shadow-2xl">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 block">Bet Amount</label>
          <input 
            type="number" 
            value={bet} 
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 0))}
            disabled={isPlaying}
            className="w-full bg-black border border-luxury-gold/40 text-luxury-gold px-4 py-3 rounded-lg font-bold focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 block">Mines Count ({minesCount})</label>
          <input 
            type="range" 
            min="1" 
            max="24" 
            value={minesCount} 
            onChange={(e) => setMinesCount(parseInt(e.target.value))}
            disabled={isPlaying}
            className="w-full accent-luxury-gold cursor-pointer"
          />
        </div>

        {isPlaying ? (
          <button 
            onClick={() => handleCashout()}
            disabled={revealed.length === 0}
            className="w-full py-4 bg-luxury-gold text-luxury-black font-cinzel font-bold text-lg rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            CASHOUT {multiplier > 0 && `(${(bet * multiplier).toFixed(2)})`}
          </button>
        ) : (
          <button 
            onClick={startGame} 
            className="w-full py-4 bg-luxury-gold text-luxury-black font-cinzel font-bold text-lg rounded-xl transition-all shadow-lg active:scale-95"
          >
            START GAME
          </button>
        )}
      </div>

      {/* Grid Panel */}
      <div className="grid grid-cols-5 gap-2 md:gap-4 p-4 bg-luxury-black rounded-2xl border border-luxury-gold/10 shadow-2xl">
        {Array.from({ length: 25 }).map((_, i) => {
          const isRevealed = revealed.includes(i);
          const isMine = minesIndices.includes(i);
          const showMine = gameOver && isMine;

          return (
            <button
              key={i}
              onClick={() => handleTileClick(i)}
              className={`w-14 h-14 md:w-20 md:h-20 rounded-xl transition-all duration-300 flex items-center justify-center text-3xl
                ${isRevealed ? 'bg-luxury-gold/20 border border-luxury-gold/50 shadow-[inset_0_0_10px_rgba(212,175,55,0.3)]' : 
                  showMine ? 'bg-red-900/50 border border-red-500' : 
                  'bg-[#222] hover:bg-[#2a2a2a] border border-white/5 shadow-lg active:scale-90'}
              `}
            >
              {isRevealed && <span className="drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]">💎</span>}
              {showMine && <span>💣</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Mines;
