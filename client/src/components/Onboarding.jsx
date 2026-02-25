import { useState } from 'react';
import { personas } from '../data/personas';
import { Leaf } from 'lucide-react';

export default function Onboarding({ onComplete }) {
    const [name, setName] = useState('');
    const [selectedPlantId, setSelectedPlantId] = useState('');
    const [deviceName, setDeviceName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !selectedPlantId) return;

        const plant = personas.find(p => p.id === selectedPlantId);

        // Generate simple UUID
        const userId = 'u_' + Math.random().toString(36).substr(2, 9);

        onComplete({
            userId,
            name,
            persona: plant.name, // The AI persona name
            plantType: plant.type,
            deviceName: deviceName || `${name}'s Companion`,
            emoji: plant.emoji
        });
    };

    return (
        <div className="glass-card p-8 max-w-md mx-auto mt-12">
            <div className="text-center mb-6">
                <div className="bg-forest-green/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Leaf className="text-forest-green w-8 h-8" />
                </div>
                <h2 className="text-2xl font-semibold">Welcome to Symbio</h2>
                <p className="text-sm text-sage mt-2">Set up your companion identity to begin.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Your Name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-parchment border border-sage/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-forest-green/50"
                        placeholder="E.g., Priya"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Choose Your Plant Persona</label>
                    <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                        {personas.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedPlantId(p.id)}
                                className={`cursor-pointer rounded-xl p-3 border text-left transition-all ${selectedPlantId === p.id ? 'border-forest-green bg-forest-green/5 shadow-md' : 'border-sage/20 bg-white hover:border-sage'}`}
                            >
                                <div className="text-2xl mb-1">{p.emoji}</div>
                                <div className="font-semibold text-sm">{p.type}</div>
                                <div className="text-xs text-forest-green font-medium mb-1">"{p.name}"</div>
                                <div className="text-[10px] text-gray-500 leading-tight">{p.description}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Device Nickname <span className="text-gray-400 font-normal">(Optional)</span></label>
                    <input
                        type="text"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        className="w-full bg-parchment border border-sage/30 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-forest-green/50"
                        placeholder="My Desk Plant"
                    />
                </div>

                <button
                    type="submit"
                    disabled={!name || !selectedPlantId}
                    className="w-full bg-forest-green text-white rounded-lg py-3 font-medium hover:bg-forest-green/90 transition-colors disabled:opacity-50"
                >
                    Initialize Companion
                </button>
            </form>
        </div>
    );
}
