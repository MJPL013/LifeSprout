import { useState } from 'react';
import { personas } from '../data/personas';

export default function Onboarding({ account, onComplete }) {
    const [name, setName] = useState(account?.name || account?.username || '');
    const [selectedPlantId, setSelectedPlantId] = useState(personas[0].id);
    const [deviceName, setDeviceName] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const selectedPlant = personas.find(p => p.id === selectedPlantId) || personas[0];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !selectedPlantId) return;

        const plant = selectedPlant;
        setError('');
        setIsSaving(true);

        try {
            await onComplete({
                ownerName: name,
                persona: plant.name,
                plantType: plant.type,
                deviceName: deviceName || `${plant.name}`,
                emoji: plant.emoji,
                imgUrl: plant.imgUrl
            });
        } catch (err) {
            setError(err.message || 'Could not provision companion device.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start py-8 max-w-2xl mx-auto w-full animate-[fadeIn_1.2s_cubic-bezier(0.22,1,0.36,1)]">
            <section className="text-center mb-8 flex flex-col items-center">
                <div className="relative mb-4">
                    <div className="absolute -inset-8 bg-primary/5 rounded-full blur-3xl"></div>
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center glass-card shadow-lg shadow-primary/5 animate-[float_6s_ease-in-out_infinite]">
                        <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-tertiary-container/30 text-tertiary rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-xs">sensors</span>
                    </div>
                </div>
                <h1 className="font-display text-4xl md:text-5xl text-on-surface mb-2 font-bold tracking-tight">
                    Provision Your Plant
                </h1>
                <p className="text-on-surface-variant text-sm max-w-md">
                    Attach a companion identity to your simulated IoT telemetry stream. You only need to do this once.
                </p>
            </section>

            <form onSubmit={handleSubmit} className="w-full space-y-8">
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-outline ml-1">
                        Owner Name
                    </label>
                    <div className="relative group">
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="What shall your companion call you?"
                            className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 px-1 py-3 text-xl font-body-md transition-all outline-none placeholder:text-outline-variant/40"
                        />
                        <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary transition-all duration-500 group-focus-within:w-full"></div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-outline ml-1">
                        Companion Device Name (Optional)
                    </label>
                    <div className="relative group">
                        <input
                            type="text"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            placeholder="Leave blank to use the persona name"
                            className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 px-1 py-3 text-xl font-body-md transition-all outline-none placeholder:text-outline-variant/40"
                        />
                        <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary transition-all duration-500 group-focus-within:w-full"></div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-outline">
                            Choose Your Plant Character
                        </label>
                        <span className="text-xs text-primary font-medium">Binding sensor profile...</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x no-scrollbar">
                        {personas.map(p => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedPlantId(p.id)}
                                className={`flex-shrink-0 w-64 glass-card rounded-3xl p-4 transition-all duration-300 cursor-pointer snap-start border-2 hover:border-primary/40 ${selectedPlantId === p.id ? 'border-primary bg-primary/5 shadow-md scale-[0.98]' : 'border-transparent bg-white/50'}`}
                            >
                                <div className="h-28 w-full mb-3 rounded-2xl overflow-hidden bg-primary/5 relative">
                                    <img
                                        className="w-full h-full object-cover opacity-90 mix-blend-multiply"
                                        alt={p.type}
                                        src={p.imgUrl}
                                    />
                                    <div className="absolute left-3 bottom-3 rounded-full bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm">
                                        {p.name}
                                    </div>
                                </div>
                                <h3 className="font-display text-lg font-bold text-primary mb-1">
                                    {p.type}
                                </h3>
                                <p className="text-on-surface-variant text-xs leading-relaxed min-h-[4.25rem]">
                                    {p.description}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-outline">{p.healthyVoice}</span>
                                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">{p.council}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="glass-card bg-white/55 p-5 rounded-3xl border border-primary/10">
                        <div className="flex gap-4 items-start">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/10 shrink-0 overflow-hidden p-1.5">
                                <img className="w-full h-full object-contain mix-blend-multiply" src={selectedPlant.imgUrl} alt={selectedPlant.type} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-outline">Selected Character</div>
                                <h3 className="font-display text-xl font-bold text-primary leading-tight">{selectedPlant.name} / {selectedPlant.type}</h3>
                                <p className="text-xs text-on-surface-variant leading-relaxed mt-1">{selectedPlant.character}</p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3 mt-4">
                            <div className="rounded-2xl bg-white/60 border border-outline-variant/20 p-3">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-outline mb-1">When Healthy</div>
                                <p className="text-xs text-on-surface leading-relaxed">Speaks {selectedPlant.healthyVoice}; the stream feels like a living {selectedPlant.statusMetaphor}.</p>
                            </div>
                            <div className="rounded-2xl bg-white/60 border border-outline-variant/20 p-3">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-outline mb-1">When Unwell</div>
                                <p className="text-xs text-on-surface leading-relaxed">{selectedPlant.unwellVoice}, then brings in {selectedPlant.council} for a tiny care plan.</p>
                            </div>
                        </div>
                        <blockquote className="mt-3 rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3 text-xs italic text-primary leading-relaxed">
                            "{selectedPlant.exampleLine}"
                        </blockquote>
                    </div>
                </div>

                {error && (
                    <div className="rounded-2xl border border-critical/15 bg-critical/5 px-4 py-3 text-xs font-medium text-critical">
                        {error}
                    </div>
                )}

                <div className="pt-4 flex flex-col items-center">
                    <button
                        type="submit"
                        disabled={!name || !selectedPlantId || isSaving}
                        className="group relative px-12 py-4 bg-primary text-white rounded-full font-bold overflow-hidden shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all duration-500 disabled:opacity-50 cursor-pointer"
                    >
                        <span className="relative z-10">{isSaving ? 'Provisioning...' : 'Provision Companion'}</span>
                        <div className="absolute inset-0 bg-primary/90 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                    </button>
                    <p className="mt-3 text-xs text-outline-variant italic">
                        This account will reopen the same allocated plant device.
                    </p>
                </div>
            </form>
        </div>
    );
}
