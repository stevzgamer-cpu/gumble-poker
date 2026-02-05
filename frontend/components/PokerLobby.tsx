import React, { useState } from 'react';

interface PokerLobbyProps {
  onCreateRoom: (isPrivate: boolean) => void;
  onJoinRoom: (roomId: string) => void;
}

const PokerLobby: React.FC<PokerLobbyProps> = ({ onCreateRoom, onJoinRoom }) => {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in duration-500">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Create Room Card */}
        <div className="bg-luxury-black/80 backdrop-blur-md border border-luxury-gold/30 p-10 rounded-[32px] flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(212,175,55,0.1)] group hover:border-luxury-gold/60 transition-all">
          <div className="w-20 h-20 bg-luxury-gold/10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <span className="text-4xl">♠️</span>
          </div>
          <h2 className="font-cinzel text-3xl text-white font-bold">VIP Table</h2>
          <p className="text-gray-400 text-center text-sm mb-4">Start a new high-stakes table and invite your friends.</p>
          <button 
            onClick={() => onCreateRoom(false)}
            className="w-full py-4 bg-luxury-gold text-luxury-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-lg"
          >
            Create Table
          </button>
        </div>

        {/* Join Room Card */}
        <div className="bg-[#050505]/80 backdrop-blur-md border border-white/10 p-10 rounded-[32px] flex flex-col items-center gap-6 shadow-2xl group hover:border-white/20 transition-all">
           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <span className="text-4xl">🚪</span>
          </div>
          <h2 className="font-cinzel text-3xl text-white font-bold">Join Table</h2>
          <p className="text-gray-400 text-center text-sm mb-4">Enter an existing Room ID to sit down.</p>
          
          <div className="w-full flex flex-col gap-3">
            <input 
              type="text" 
              placeholder="ENTER ROOM ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-center text-white font-mono tracking-widest focus:outline-none focus:border-luxury-gold transition-colors"
            />
            <button 
              onClick={() => joinId && onJoinRoom(joinId)}
              disabled={!joinId}
              className="w-full py-4 bg-white/10 text-white font-black uppercase tracking-widest rounded-xl hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Join Seat
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PokerLobby;