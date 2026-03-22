import { Droplet, Sun, Thermometer, Activity } from 'lucide-react';

const MetricBar = ({ icon: Icon, label, value, colorClass, max = 100 }) => {
    const percentage = Math.max(0, Math.min(100, (value / max) * 100));
    const tc = colorClass.split(' ')[0]; // text-color
    const bc = colorClass.split(' ')[1]; // bg-color

    return (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5 text-xs text-ink font-medium">
                    <Icon className={`w-3.5 h-3.5 ${tc}`} />
                    {label}
                </div>
                <div className="text-xs font-mono">{Math.round(value)}{label === 'Temp' ? '°C' : '%'}</div>
            </div>
            <div className="h-1.5 w-full bg-sage/20 rounded-full overflow-hidden">
                <div
                    className={`h-full ${bc} rounded-full transition-all duration-1000 ease-in-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

export default function MyCompanion({ user, metrics }) {
    if (!metrics) {
        return (
            <div className="glass-card flex-1 flex flex-col items-center justify-center p-6 text-sage text-center animate-pulse">
                <div className="w-16 h-16 rounded-full bg-sage/20 mb-4" />
                <p>Syncing telemetry...</p>
            </div>
        );
    }

    const { moisture, sunlight, temperature, soil_health, mood, event } = metrics;

    // Mood styling map
    const moodStyles = {
        thriving: { color: 'text-thriving', bg: 'bg-thriving/10', label: 'Thriving', anim: 'animate-bounce' },
        stable: { color: 'text-forest-green', bg: 'bg-forest-green/10', label: 'Stable', anim: '' },
        struggling: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Struggling', anim: '' },
        critical: { color: 'text-critical', bg: 'bg-critical/10', label: 'Critical', anim: 'animate-pulse' }
    };

    const ms = moodStyles[mood] || moodStyles.stable;

    return (
        <div className="glass-card flex-1 p-6 flex flex-col relative overflow-y-auto overflow-x-hidden">
            {/* Visual Header */}
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold">{user.persona}</h2>
                <p className="text-sm text-sage capitalize">{user.plantType}</p>

                {/* Plant Avatar */}
                <div className={`mt-6 w-32 h-32 mx-auto rounded-full ${ms.bg} flex items-center justify-center border-4 border-white shadow-sm relative transition-colors duration-1000`}>
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/40 to-transparent rounded-full" />
                    <span className={`text-6xl drop-shadow-md pb-2 ${ms.anim} transition-transform`}>
                        {user.emoji}
                    </span>

                    {/* Mood Badge */}
                    <div className={`absolute -bottom-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md bg-white/90 shadow-sm border border-white/40 ${ms.color} transition-colors duration-1000`}>
                        {ms.label}
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="bg-white/50 rounded-xl p-4 mt-auto">
                <MetricBar icon={Droplet} label="Moisture" value={moisture} colorClass="text-blue-500 bg-blue-500" />
                <MetricBar icon={Sun} label="Sunlight" value={sunlight} colorClass="text-yellow-500 bg-yellow-500" />
                <MetricBar icon={Thermometer} label="Temp" value={temperature} colorClass="text-orange-500 bg-orange-500" max={40} />
                <MetricBar icon={Activity} label="Soil Vitality" value={soil_health} colorClass="text-forest-green bg-forest-green" />
            </div>

            {event && event !== 'none' && (
                <div className="absolute top-4 right-4 text-[10px] font-mono text-sage uppercase tracking-wider bg-white px-2 py-0.5 rounded shadow-sm opacity-50">
                    EVENT: {event}
                </div>
            )}
        </div>
    );
}
