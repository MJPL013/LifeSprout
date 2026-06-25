import { useRef, useState } from 'react';
import { VOICE_PRESETS, VOICE_PROVIDERS, playVoicePreview } from '../utils/voice';

export default function VoiceSelector({ value, onChange, provider = 'deepgram', onProviderChange }) {
    const [previewingId, setPreviewingId] = useState(null);
    const [previewIssueId, setPreviewIssueId] = useState(null);
    const previewRunRef = useRef(0);

    const handleSelect = async (presetId) => {
        const preset = VOICE_PRESETS.find(item => item.id === presetId);
        const runId = previewRunRef.current + 1;
        previewRunRef.current = runId;
        if (preset?.provider && preset.provider !== provider) onProviderChange?.(preset.provider);
        onChange(presetId);
        setPreviewIssueId(null);
        setPreviewingId(presetId);

        const result = await playVoicePreview(presetId);
        if (previewRunRef.current !== runId) return;

        if (result?.provider === 'unavailable') {
            setPreviewIssueId(presetId);
        }
        setPreviewingId(null);
    };

    const handleProviderSelect = (providerId) => {
        onProviderChange?.(providerId);
        const currentPreset = VOICE_PRESETS.find(item => item.id === value);
        if (currentPreset?.provider === providerId) return;

        const firstProviderVoice = VOICE_PRESETS.find(item => item.provider === providerId);
        if (firstProviderVoice) onChange(firstProviderVoice.id);
    };

    return (
        <div className="glass-card p-4 bg-white/40 flex flex-col gap-3 overflow-visible">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-outline">Companion Voice</span>
                    <h4 className="font-display text-sm font-bold text-primary leading-tight">Plant Voice</h4>
                </div>
                <span className="material-symbols-outlined text-primary text-lg animate-pulse">graphic_eq</span>
            </div>

            <div
                className="grid grid-cols-1 gap-3 pt-3 pb-2 px-1 max-h-[44dvh] md:max-h-[360px] overflow-y-auto overflow-x-visible overscroll-contain touch-pan-y no-scrollbar"
                role="radiogroup"
                aria-label="Plant voice presets"
                onWheel={(event) => event.stopPropagation()}
                onTouchMove={(event) => event.stopPropagation()}
            >
                {VOICE_PRESETS.map((preset) => {
                    const active = preset.id === value;
                    const previewing = previewingId === preset.id;
                    const hasIssue = previewIssueId === preset.id;
                    const providerLabel = preset.provider === 'sarvam' ? 'Sarvam' : 'Deepgram';
                    const voiceMeta = preset.provider === 'sarvam'
                        ? `${preset.speaker || 'voice'} / ${preset.languageCode || 'en-IN'}`
                        : preset.model.replace('aura-2-', '').replace('-en', '');

                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelect(preset.id)}
                            className={`group relative text-left rounded-2xl border px-3 py-2.5 transition-all duration-500 cursor-pointer overflow-visible will-change-transform scroll-mt-4 ${active
                                ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/10 scale-[1.04] -translate-y-1'
                                : 'bg-white/55 border-outline-variant/20 hover:border-primary/25 hover:bg-white/85 hover:scale-[1.018] hover:-translate-y-0.5 active:scale-[0.99]'}`}
                            aria-pressed={active}
                        >
                            {active && (
                                <span className="pointer-events-none absolute left-4 -top-2 h-3 w-24 overflow-hidden rounded-full border border-primary/20 bg-white/80 shadow-sm">
                                    <span className="voice-cursor-glide absolute left-1 top-1 h-1 w-10 rounded-full bg-primary/55" />
                                </span>
                            )}

                            {active && (
                                <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                                    <span className="voice-card-sheen absolute -top-4 bottom-0 w-10 bg-white" />
                                </span>
                            )}

                            <div className="relative flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <span className={`block text-[11px] font-bold truncate transition-colors ${active ? 'text-primary' : 'text-on-surface'}`}>
                                        {preset.label}
                                    </span>
                                    <span className="block text-[8px] uppercase tracking-wider text-outline font-bold mt-0.5 truncate">
                                        {providerLabel} / {voiceMeta}
                                    </span>
                                </div>

                                <span className={`relative grid place-items-center w-9 h-9 rounded-full border transition-all duration-500 shrink-0 ${active
                                    ? 'bg-white border-primary/25 scale-90 shadow-inner'
                                    : 'bg-primary/5 border-primary/10 group-hover:scale-90'}`}
                                >
                                    {previewing ? (
                                        <span className="flex h-4 items-end gap-0.5">
                                            <span className="voice-level-bar block h-3 w-1 rounded-full bg-primary/75" />
                                            <span className="voice-level-bar block h-4 w-1 rounded-full bg-primary/90" />
                                            <span className="voice-level-bar block h-2.5 w-1 rounded-full bg-primary/60" />
                                        </span>
                                    ) : (
                                        <span className={`material-symbols-outlined text-base transition-transform duration-500 ${active ? 'text-primary scale-75' : 'text-outline group-hover:text-primary group-hover:scale-75'}`}>
                                            {active ? 'check_circle' : 'play_circle'}
                                        </span>
                                    )}
                                </span>
                            </div>

                            <p className={`relative text-[10px] leading-snug mt-1 transition-colors ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                                {hasIssue ? 'Preview file is not available yet.' : preset.description}
                            </p>
                        </button>
                    );
                })}
            </div>

            <div className="border-t border-outline-variant/20 pt-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-outline">Voice Engine</span>
                        <p className="text-[10px] text-on-surface-variant leading-snug">Choose Deepgram or Sarvam for spoken output.</p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-base">tune</span>
                </div>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Voice engine provider">
                    {VOICE_PROVIDERS.map((item) => {
                        const active = item.id === provider;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleProviderSelect(item.id)}
                                className={`rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer ${active
                                    ? 'bg-primary/10 border-primary/40 text-primary shadow-sm'
                                    : 'bg-white/55 border-outline-variant/20 text-on-surface hover:border-primary/25 hover:bg-white/85'}`}
                                aria-pressed={active}
                            >
                                <span className="block text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                                <span className="block text-[8px] font-bold uppercase tracking-wider text-outline mt-0.5">{item.eyebrow}</span>
                                <span className="block text-[9px] leading-snug text-on-surface-variant mt-1">{item.description}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}


