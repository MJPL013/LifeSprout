import { Mic } from 'lucide-react';

const STATUS_COPY = {
    idle: 'Start voice input',
    starting: 'Opening microphone...',
    listening: 'Listening now',
    stopping: 'Stopping microphone...',
    error: 'Mic unavailable'
};

export default function MicButton({ status = 'idle', onClick, title = 'Voice input' }) {
    const isActive = status === 'starting' || status === 'listening';
    const isStopping = status === 'stopping';
    const isError = status === 'error';

    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer overflow-visible active:scale-95 ${isActive
                ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-105'
                : isStopping
                    ? 'bg-outline-variant/40 text-outline shadow-inner scale-95'
                    : isError
                        ? 'bg-error-container/20 text-critical border border-critical/20'
                        : 'bg-primary/10 text-primary hover:bg-primary/20 shadow-sm'}`}
            title={`${title}: ${STATUS_COPY[status] || STATUS_COPY.idle}`}
            aria-pressed={isActive}
            aria-label={`${title}: ${STATUS_COPY[status] || STATUS_COPY.idle}`}
        >
            {isActive && (
                <>
                    <span className="absolute inset-0 rounded-full bg-primary/30 animate-[mic-ring_1.3s_ease-out_infinite]" />
                    <span className="absolute -inset-1 rounded-full border border-primary/30 animate-[mic-ring_1.3s_ease-out_infinite_0.25s]" />
                </>
            )}
            {isStopping && <span className="absolute inset-1 rounded-full border border-outline/30 animate-[mic-collapse_0.34s_ease-out]" />}
            <Mic className={`relative z-10 w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : isStopping ? 'scale-75' : ''}`} />
            {isActive && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-3">
                    <span className="mic-level-bar w-0.5 h-2 rounded-full bg-primary" />
                    <span className="mic-level-bar w-0.5 h-3 rounded-full bg-primary" />
                    <span className="mic-level-bar w-0.5 h-1.5 rounded-full bg-primary" />
                </span>
            )}
        </button>
    );
}