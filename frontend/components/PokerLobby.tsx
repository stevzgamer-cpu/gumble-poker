
import React, { useState } from 'react';

interface PokerLobbyProps {
  onCreateRoom: (isPrivate: boolean) => void;
  onJoinRoom: (roomId: string) => void;
}

const PokerLobby: React.FC<PokerLobbyProps> = ({ onCreateRoom, onJoinRoom }) => {
  const [joinId, setJoinId] = useState('');

  const mockTables = [
    { id: 'MC102', name: 'The Macau Grand', blinds: '100/200', players: '4/9', minBuyIn: '$2,000', isPrivate: false },
    { id: 'LV777', name: 'Vegas High Roller', blinds: '500/1000', players: '7/9', minBuyIn: '$10,000', isPrivate: false },
    { id: 'MN500', name: 'Monaco Private', blinds: '200/400', players: '2/6', minBuyIn: '$5,000', isPrivate: true },
    { id: 'LON01', name: 'London Knights', blinds: '50/100', players: '8/9', minBuyIn: '$1,000', isPrivate: false },
  ];

  return (
    <div className="flex flex-col items-center gap-10 py-8 animate-in fade-in zoom-in duration-700">
      <div className="text-center">
        <h2 className="font-cinzel text-5xl md:text-6xl gold-text-gradient font-bold tracking-widest mb-2">POKER LOUNGE</h2>
        <p className="text-gray-500 font-montserrat uppercase tracking-[0.4em] text-[10px]">Select a Table or Create Your Private Domain</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-6xl px-4">
        {/* Actions Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-luxury-card border border-luxury-gold/20 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl">
            <h3 className="font-cinzel text-xl text-white font-bold border-b border-white/5 pb-4">Host Table</h3>
            <button 
              onClick={() => onCreateRoom(false)}
              className="w-full py-4 bg-luxury-gold text-luxury-black font-bold rounded-xl uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all gold-glow"
            >
              Create Public Table
            </button>
            <button 
              onClick={() => onCreateRoom(true)}
              className="w-full py-4 border border-luxury-gold text-luxury-gold font-bold rounded-xl uppercase tracking-widest text-xs hover:bg-luxury-gold/10 transition-all"
            >
              Create Private Table
            </button>
          </div>

          <div className="bg-luxury-card border border-luxury-gold/20 rounded-3xl p-8 flex flex-col gap-4 shadow-2xl">
            <h3 className="font-cinzel text-xl text-white font-bold border-b border-white/5 pb-4">Join by ID</h3>
            <div className="relative">
              <input 
                type="text" 
                placeholder="ROOM ID (e.g. LV777)"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                className="w-full bg-black border border-white/10 text-luxury-gold px-4 py-3 rounded-xl focus:outline-none focus:border-luxury-gold transition-all text-sm font-bold uppercase"
              />
            </div>
            <button 
              onClick={() => joinId && onJoinRoom(joinId)}
              disabled={!joinId}
              className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl uppercase tracking-widest text-xs hover:bg-white/10 transition-all disabled:opacity-30"
            >
              Join Room
            </button>
          </div>
        </div>

        {/* Tables List */}
        <div className="lg:col-span-8 bg-luxury-card/50 border border-luxury-gold/10 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl backdrop-blur-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-cinzel text-xl text-white font-bold">Live Tables</h3>
            <span className="bg-luxury-gold/10 text-luxury-gold text-[10px] font-bold px-3 py-1 rounded-full border border-luxury-gold/20">
              {mockTables.length} TABLES ONLINE
            </span>
          </div>

          <div className="space-y-4">
            {mockTables.map((table) => (
              <div 
                key={table.id}
                className="bg-black/40 border border-white/5 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 hover:border-luxury-gold/30 transition-all group cursor-pointer"
                onClick={() => onJoinRoom(table.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-luxury-black rounded-full border border-luxury-gold/20 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform">
                    {table.isPrivate ? '🔒' : '🎭'}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm group-hover:text-luxury-gold transition-colors">{table.name}</h4>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">ID: {table.id} • {table.isPrivate ? 'Private' : 'Public'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 md:gap-12 text-center">
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase font-black">Blinds</p>
                    <p className="text-xs text-white font-bold">{table.blinds}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase font-black">Buy-in</p>
                    <p className="text-xs text-luxury-gold font-bold">{table.minBuyIn}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase font-black">Players</p>
                    <p className="text-xs text-white font-bold">{table.players}</p>
                  </div>
                </div>

                <button className="px-6 py-2 bg-luxury-gold/10 border border-luxury-gold/20 text-luxury-gold text-[10px] font-bold uppercase rounded-lg group-hover:bg-luxury-gold group-hover:text-luxury-black transition-all">
                  Seat
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PokerLobby;
