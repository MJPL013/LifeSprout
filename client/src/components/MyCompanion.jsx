import { Droplet, Sun, Thermometer, Activity } from 'lucide-react';

const MetricBar = ({ icon, label, value, colorClass, max = 100 }) => {
    const MetricIcon = icon;
    const percentage = Math.max(0, Math.min(100, (value / max) * 100));

    return (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                    <MetricIcon className={`w-3.5 h-3.5 ${colorClass.text}`} />
                    <span>{label}</span>
                </div>
                <div className="text-xs font-mono text-on-surface font-semibold">
                    {Math.round(value)}{label === 'Temp' ? ' C' : '%'}
                </div>
            </div>
            <div className="h-1.5 w-full bg-outline-variant/20 rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClass.bg} rounded-full transition-all duration-1000 ease-in-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

export default function MyCompanion({ user, metrics }) {
    if (!metrics) {
        return (
            <div className="glass-card flex-1 flex flex-col items-center justify-center p-6 text-center animate-pulse min-h-[340px]">
                <div className="w-16 h-16 rounded-full bg-outline-variant/30 mb-4" />
                <p className="text-sm text-outline font-semibold">Syncing telemetry...</p>
            </div>
        );
    }

    const { moisture, sunlight, temperature, soil_health, mood, event } = metrics;

    // Get color themes based on species ID
    const getSpeciesColors = (type) => {
        const lowerType = (type || '').toLowerCase();
        if (lowerType.includes('cactus')) {
            return { stroke: '#8c4f10', fill: '#ffdcc2', text: 'text-tertiary', bg: 'bg-tertiary/10' };
        }
        if (lowerType.includes('fern')) {
            return { stroke: '#625f46', fill: '#e8e3c4', text: 'text-secondary', bg: 'bg-secondary/10' };
        }
        if (lowerType.includes('pothos')) {
            return { stroke: '#7baf6e', fill: '#e5e1c1', text: 'text-primary', bg: 'bg-primary/10' };
        }
        // Monstera / Default
        return { stroke: '#396931', fill: '#baf1aa', text: 'text-primary', bg: 'bg-primary/10' };
    };

    const sc = getSpeciesColors(user.plantType);

    // Mood override parameters
    const getMoodParameters = (currentMood) => {
        switch (currentMood) {
            case 'critical':
                return {
                    label: 'Critical',
                    color: 'text-critical',
                    bg: 'bg-error-container/20 border-error/20',
                    nodeColor: '#ba1a1a',
                    strokeColor: '#ba1a1a',
                    animationClass: 'animate-ping duration-1000'
                };
            case 'struggling':
                return {
                    label: 'Struggling',
                    color: 'text-tertiary',
                    bg: 'bg-tertiary-container/10 border-tertiary/20',
                    nodeColor: '#8c4f10',
                    strokeColor: sc.stroke,
                    animationClass: ''
                };
            case 'thriving':
                return {
                    label: 'Thriving',
                    color: 'text-primary',
                    bg: 'bg-primary-container/20 border-primary/20',
                    nodeColor: '#ffdcc2',
                    strokeColor: sc.stroke,
                    animationClass: 'animate-pulse'
                };
            default: // stable
                return {
                    label: 'Stable',
                    color: 'text-secondary',
                    bg: 'bg-surface-container border-outline/20',
                    nodeColor: '#8c4f10',
                    strokeColor: sc.stroke,
                    animationClass: ''
                };
        }
    };

    const mp = getMoodParameters(mood);

    return (
        <div className="glass-card flex-1 p-5 flex flex-col relative overflow-y-auto overflow-x-hidden min-h-[320px] md:min-h-[420px] transition-all duration-500">
            {/* Visual Header */}
            <div className="text-center flex flex-col items-center">
                <h3 className="text-lg font-bold font-display text-on-surface leading-snug">{user.deviceName}</h3>
                <p className="text-[10px] text-outline font-semibold uppercase tracking-widest">{user.plantType} Companion</p>

                {/* dynamic SVG breathing origami */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center mt-3 mb-2">
                    <div className="absolute inset-0 bg-gradient-radial from-primary/5 to-transparent blur-md"></div>
                    <div className="breathing-origami w-28 h-28 md:w-36 md:h-36">
                        <svg className="w-full h-full fill-none" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                            <path d="M100 20 L140 80 L100 140 L60 80 Z" fill={sc.stroke} fillOpacity="0.08" stroke={mp.strokeColor} strokeWidth="0.75"></path>
                            <path d="M100 20 L180 60 L140 80 Z" fill={sc.stroke} fillOpacity="0.04" stroke={mp.strokeColor} strokeWidth="0.5"></path>
                            <path d="M180 60 L140 80 L180 140 Z" fill={sc.stroke} fillOpacity="0.06" stroke={mp.strokeColor} strokeWidth="0.5"></path>
                            <path d="M100 140 L180 140 L140 80 Z" fill={sc.stroke} fillOpacity="0.04" stroke={mp.strokeColor} strokeWidth="0.5"></path>
                            <path d="M20 60 L100 20 L60 80 Z" fill={sc.stroke} fillOpacity="0.04" stroke={mp.strokeColor} strokeWidth="0.5"></path>
                            <path d="M20 60 L60 80 L20 140 Z" fill={sc.stroke} fillOpacity="0.06" stroke={mp.strokeColor} strokeWidth="0.5"></path>
                            <path d="M100 140 L60 80 L20 140 Z" fill={sc.stroke} fillOpacity="0.04" stroke={mp.strokeColor} strokeWidth="0.5"></path>
                            {/* Pulsing center node */}
                            <circle className={mp.animationClass} cx="100" cy="80" fill={mp.nodeColor} r="4"></circle>
                        </svg>
                    </div>

                    {/* Mood Badge */}
                    <div className={`absolute bottom-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md bg-white/90 border shadow-sm ${mp.color} ${mp.bg} transition-colors duration-1000`}>
                        {mp.label}
                    </div>
                </div>
            </div>

            {/* Metrics list */}
            <div className="bg-white/40 border border-white/20 rounded-2xl p-4 mt-auto">
                <MetricBar icon={Droplet} label="Moisture" value={moisture} colorClass={{ text: 'text-blue-500', bg: 'bg-blue-500/80' }} />
                <MetricBar icon={Sun} label="Sunlight" value={sunlight} colorClass={{ text: 'text-amber-500', bg: 'bg-amber-500/80' }} />
                <MetricBar icon={Thermometer} label="Temp" value={temperature} colorClass={{ text: 'text-orange-500', bg: 'bg-orange-500/80' }} max={40} />
                <MetricBar icon={Activity} label="Soil Vitality" value={soil_health} colorClass={{ text: sc.text, bg: `bg-primary/80` }} />
            </div>

            {event && event !== 'none' && (
                <div className="absolute top-4 right-4 text-[9px] font-mono text-outline uppercase tracking-wider bg-white/70 px-2 py-0.5 rounded shadow-sm opacity-60">
                    {event}
                </div>
            )}
        </div>
    );
}
