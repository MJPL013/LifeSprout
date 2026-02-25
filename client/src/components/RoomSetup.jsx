import { useState } from 'react';
import { Users, Plus } from 'lucide-react';

export default function RoomSetup({ user, onJoin }) {
    const [roomCode, setRoomCode] = useState('');

    const generateRoom = () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        onJoin(code);
    };

    const handleJoin = (e) => {
        e.preventDefault();
        if (roomCode.trim().length > 0) {
            onJoin(roomCode.trim().toUpperCase());
        }
    };

    return (
        <div className="glass-card p-8 max-w-md mx-auto mt-12">
            <div className="text-center mb-8">
                <div className="bg-sage/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    {user.emoji}
                </div>
                <h2 className="text-2xl font-semibold">Hello, {user.name}</h2>
                <p className="text-sm text-sage mt-1">Your companion "{user.persona}" is ready.</p>
            </div>

            <div className="space-y-6">
                <button
                    onClick={generateRoom}
                    className="w-full flex flex-col items-center justify-center bg-white border-2 border-forest-green border-dashed rounded-xl p-6 hover:bg-forest-green/5 transition-colors group"
                >
                    <Plus className="text-forest-green w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-medium text-forest-green">Create a New Room</span>
                    <span className="text-xs text-sage mt-1">Start a fresh space for you and friends</span>
                </button>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-sage/20"></div>
                    <span className="flex-shrink-0 mx-4 text-sage text-sm uppercase tracking-wider">Or</span>
                    <div className="flex-grow border-t border-sage/20"></div>
                </div>

                <form onSubmit={handleJoin} className="space-y-3">
                    <label className="block text-sm font-medium mb-1">Join Existing Room</label>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value)}
                            placeholder="Enter 6-letter code"
                            className="flex-1 bg-parchment border border-sage/30 rounded-lg px-4 py-3 text-center uppercase tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-forest-green/50"
                            maxLength={6}
                        />
                        <button
                            type="submit"
                            disabled={roomCode.length < 3}
                            className="bg-forest-green text-white px-6 rounded-lg font-medium hover:bg-forest-green/90 transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                            <Users className="w-5 h-5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
