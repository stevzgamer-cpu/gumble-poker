
import React, { useState, useMemo } from 'react';
import { GameOutcome, GameStatus } from '../types';

interface DragonTowerProps {
  onGameEnd: (outcome: GameOutcome) => void;
  balance: number;
}

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

const DragonTower: React.FC<DragonTowerProps> = ({ onGameEnd, balance }) => {
  const [bet, setBet] = useState(100);
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTier, setCurrentTier] = useState(0); // 0 to 8
  const [results, setResults] = useState<{ [tier: number]: number[] }>({}); // Safe indices
  const [picked, setPicked] = useState<{ [tier: number]: number }>({});

  const towerConfig = {
    EASY: { tiles: 4, safe: 3, multiplier: 1.3 },
    MEDIUM: { tiles: 3, safe: 2, multiplier: 1.45 },
    HARD: { tiles: 2, safe: 1, multiplier: 1.95 },
  };

  const currentMultiplier = useMemo(() => {
    if (currentTier === 0) return 1;
    return Math.pow(towerConfig[difficulty].multiplier, currentTier);
  }, [currentTier, difficulty]);

  const startGame = () => {
    if (balance < bet) return;
    setResults({});
    setPicked({});
    setCurrentTier(0);
    setIsPlaying(true);
  };

  const handleTileClick = (tier: number, tileIdx: number) => {
    if (!isPlaying || tier !== currentTier) return;

    // Generate results for this tier if not already done
    const config = towerConfig[difficulty];
    const safeTiles: number[] = [];
    while (safeTiles.length < config.safe) {
      const idx = Math.floor(Math.random() * config.tiles);
      if (!safeTiles.includes(idx)) safeTiles.push(idx);
    }
    
    setResults(prev => ({ ...prev, [tier]: safeTiles }));
    setPicked(prev => ({ ...prev, [tier]: tileIdx }));

    if (safeTiles.includes(tileIdx)) {
      if (tier === 8) {
        // Top reached
        const winAmount = Math.floor(bet * (Math.pow(config.multiplier, 9) - 1));
        setIsPlaying(false);
        onGameEnd({ status: GameStatus.WON, amount: winAmount, message: 'Tower Conquered!' });
      } else {
        setCurrentTier(tier + 1);
      }
    } else {
      // Failed
      setIsPlaying(false);
      onGameEnd({ status: GameStatus.LOST, amount: -bet, message: 'You fell from the tower!' });
    }
  };

  const handleCashout = () => {
    if (!isPlaying || currentTier === 0) return;
    const winAmount = Math.floor(bet * (currentMultiplier - 1));
    setIsPlaying(false);
    onGameEnd({ status: GameStatus.WON, amount: winAmount, message: `Cashed out at Tier ${currentTier}` });
  };

  return (
    <div className="flex flex-col md:flex-row gap-12 items-center justify-center min-h-[600px] p-4">
      <div className="w-full md:w-72 bg-[#121212] rounded-2xl p-6 border border-luxury-gold/20 flex flex-col gap-6 order-2 md:order-1">
        <h3 className="font-cinzel text-xl text-luxury-gold text-center mb-2">Controls</h3>
        
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2 block">Difficulty</label>
          <div className="flex gap-2">
            {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                disabled={isPlaying}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border
                  ${difficulty === d ? 'bg-luxury-gold text-luxury-black border-luxury-gold' : 'bg-black text-gray-400 border-white/10'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

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

        {isPlaying ? (
          <button 
            onClick={handleCashout}
            disabled={currentTier === 0}
            className="w-full py-4 bg-luxury-gold text-luxury-black font-cinzel font-bold text-lg rounded-xl shadow-lg disabled:opacity-50"
          >
            CASHOUT {currentTier > 0 && `(${(bet * currentMultiplier).toFixed(2)})`}
          </button>
        ) : (
          <button onClick={startGame} className="w-full py-4 bg-luxury-gold text-luxury-black font-cinzel font-bold text-lg rounded-xl shadow-lg">
            ENTER TOWER
          </button>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 bg-[#0a0a0a] p-6 rounded-3xl border border-luxury-gold/10 order-1 md:order-2">
        {Array.from({ length: 9 }).map((_, tierIdx) => {
          const config = towerConfig[difficulty];
          const isCurrent = currentTier === tierIdx && isPlaying;
          const isPast = tierIdx < currentTier;
          const tierResults = results[tierIdx];
          const tierPicked = picked[tierIdx];

          return (
            <div key={tierIdx} className={`flex gap-3 items-center transition-all duration-500 ${isCurrent ? 'scale-105' : 'opacity-60 grayscale-[0.5]'}`}>
              <div className="w-10 text-[10px] text-luxury-gold font-bold">x{(Math.pow(config.multiplier, tierIdx + 1)).toFixed(2)}</div>
              <div className="flex gap-2 p-1.5 bg-luxury-black rounded-lg border border-white/5">
                {Array.from({ length: config.tiles }).map((_, tileIdx) => {
                  const isSafe = tierResults?.includes(tileIdx);
                  const wasPicked = tierPicked === tileIdx;
                  const showStatus = tierResults !== undefined;

                  return (
                    <button
                      key={tileIdx}
                      onClick={() => handleTileClick(tierIdx, tileIdx)}
                      disabled={!isCurrent}
                      className={`w-12 h-10 md:w-16 md:h-12 rounded flex items-center justify-center transition-all duration-300
                        ${isCurrent ? 'bg-[#333] hover:bg-luxury-gold/20 border-white/10 hover:border-luxury-gold/50 cursor-pointer shadow-lg' : 
                          showStatus ? (isSafe ? 'bg-luxury-gold/30' : (wasPicked ? 'bg-red-900/40 border-red-500' : 'bg-luxury-black')) :
                          'bg-[#1a1a1a] cursor-default border-transparent'}
                      `}
                    >
                      {showStatus && isSafe && <span className="text-xl">💰</span>}
                      {showStatus && !isSafe && wasPicked && <span className="text-xl">💀</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DragonTower;
