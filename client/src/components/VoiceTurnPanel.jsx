import { Mic, Waves } from 'lucide-react';

const STATUS_LABELS = {
    starting: 'Opening voice link',
    listening: 'Listening',
    processing: 'Sending to companion',
    stopping: 'Closing voice link',
    error: 'Voice unavailable'
};

export default function VoiceTurnPanel({ status, transcript, onCancel }) {
    const isProcessing = status === 'processing';
    const isStopping = status === 'stopping';
    const label = STATUS_LABELS[status] || STATUS_LABELS.listening;

    return (
        <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/10 backdrop-blur-[2px] px-3 pb-24 md:pb-6 animate-[fadeIn_0.18s_ease-out]" onMouseDown={onCancel}>
            <div
                className={`w-full max-w-xl rounded-[1.5rem] border bg-white/95 shadow-2xl px-4 py-4 md:px-5 md:py-5 transition-all duration-300 ${isStopping ? 'scale-95 opacity-80 border-outline-variant/40' : 'scale-100 border-primary/20'}`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-visible">
                        {!isProcessing && !isStopping && (
                            <>
                                <span className="absolute inset-0 rounded-full bg-primary/20 animate-[mic-ring_1.25s_ease-out_infinite]" />
                                <span className="absolute -inset-2 rounded-full border border-primary/25 animate-[mic-ring_1.25s_ease-out_infinite_0.22s]" />
                            </>
                        )}
                        {isProcessing ? <Waves className="relative z-10 w-5 h-5 animate-pulse" /> : <Mic className="relative z-10 w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{label}</div>
                        <div className="min-h-[2.5rem] text-sm md:text-base text-on-surface leading-snug font-medium line-clamp-2">
                            {transcript || '...'}
                        </div>
                        <div className="mt-3 flex items-end gap-1 h-5 text-primary/80">
                            <span className="mic-level-bar w-1 h-3 rounded-full bg-primary/70" />
                            <span className="mic-level-bar w-1 h-5 rounded-full bg-primary/80" />
                            <span className="mic-level-bar w-1 h-2 rounded-full bg-primary/60" />
                            <span className="mic-level-bar w-1 h-4 rounded-full bg-primary/75" />
                            <span className="mic-level-bar w-1 h-2.5 rounded-full bg-primary/60" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}