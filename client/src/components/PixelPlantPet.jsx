import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

const SPRITE_BODIES = [
    {
        id: 'sprout',
        label: 'Sprout Signal',
        note: 'Curious and alert, always leaning toward the next signal.',
        className: 'garden-sprite--sprout'
    },
    {
        id: 'moss',
        label: 'Moss Byte',
        note: 'Soft, round, sleepy, and calm around emotional moments.',
        className: 'garden-sprite--moss'
    },
    {
        id: 'bloom',
        label: 'Bloom Dot',
        note: 'Dramatic, sparkly, and quick to celebrate tiny wins.',
        className: 'garden-sprite--bloom'
    },
    {
        id: 'cactus',
        label: 'Prickle Ping',
        note: 'Small, stubborn, desert-bright, and quietly watchful.',
        className: 'garden-sprite--cactus'
    }
];

const MOOD_LABELS = {
    idle: 'calm',
    listening: 'listening',
    thinking: 'thinking',
    speaking: 'speaking',
    happy: 'bright',
    comforting: 'soft',
    concerned: 'careful'
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function getDefaultSpriteId(userId = '') {
    const seed = String(userId || 'sprite').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return SPRITE_BODIES[seed % SPRITE_BODIES.length].id;
}

export function getSpriteVariants() {
    return SPRITE_BODIES;
}

export default function PixelPlantPet({
    mood = 'idle',
    user = {},
    metrics = {},
    muted = false,
    selectedSpriteId,
    onClick
}) {
    const safeMood = MOOD_LABELS[mood] ? mood : 'idle';
    const selectedSprite = SPRITE_BODIES.find(item => item.id === selectedSpriteId) || SPRITE_BODIES[0];
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [position, setPosition] = useState({ x: 28, y: 32 });
    const positionRef = useRef(position);
    const targetRef = useRef(position);
    const pointerModeRef = useRef(false);
    const telemetryMood = String(metrics?.mood || 'stable').toLowerCase();
    const statusLabel = muted ? 'quiet' : MOOD_LABELS[safeMood];

    const movementLabel = useMemo(() => {
        if (safeMood === 'listening') return 'near your voice';
        if (safeMood === 'thinking') return 'reading signal';
        if (safeMood === 'comforting') return 'staying close';
        if (safeMood === 'happy') return 'spark mode';
        if (safeMood === 'concerned') return 'careful orbit';
        return 'wandering';
    }, [safeMood]);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const initialX = Math.max(18, window.innerWidth - 146);
        const initialY = Math.max(92, window.innerHeight - 196);
        setPosition({ x: initialX, y: initialY });
        targetRef.current = { x: initialX, y: initialY };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
        let pointerReleaseId;

        const setTargetNearPointer = (event) => {
            if (!canHover) return;
            pointerModeRef.current = true;
            if (pointerReleaseId) window.clearTimeout(pointerReleaseId);
            pointerReleaseId = window.setTimeout(() => {
                pointerModeRef.current = false;
            }, 1800);

            const current = positionRef.current;
            const safeZone = {
                left: current.x - 28,
                right: current.x + 196,
                top: current.y - 48,
                bottom: current.y + 138
            };

            if (
                event.clientX >= safeZone.left &&
                event.clientX <= safeZone.right &&
                event.clientY >= safeZone.top &&
                event.clientY <= safeZone.bottom
            ) {
                targetRef.current = current;
                return;
            }

            const offsetX = event.clientX > window.innerWidth - 200 ? -126 : 36;
            const offsetY = event.clientY > window.innerHeight - 180 ? -112 : 30;
            targetRef.current = {
                x: clamp(event.clientX + offsetX, 14, window.innerWidth - 132),
                y: clamp(event.clientY + offsetY, 86, window.innerHeight - 138)
            };
        };

        const wander = () => {
            if (pointerModeRef.current) return;
            targetRef.current = {
                x: clamp(18 + Math.random() * (window.innerWidth - 164), 14, window.innerWidth - 132),
                y: clamp(96 + Math.random() * (window.innerHeight - 280), 86, window.innerHeight - 138)
            };
        };

        let frameId;
        const animate = () => {
            const current = positionRef.current;
            const target = targetRef.current;
            const next = {
                x: current.x + (target.x - current.x) * 0.045,
                y: current.y + (target.y - current.y) * 0.045
            };
            positionRef.current = next;
            setPosition(next);
            frameId = window.requestAnimationFrame(animate);
        };

        const wanderId = window.setInterval(wander, 5400);
        window.addEventListener('pointermove', setTargetNearPointer, { passive: true });
        frameId = window.requestAnimationFrame(animate);
        wander();

        return () => {
            window.removeEventListener('pointermove', setTargetNearPointer);
            window.clearInterval(wanderId);
            if (pointerReleaseId) window.clearTimeout(pointerReleaseId);
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    if (!selectedSpriteId) return null;

    return (
        <div
            className={clsx('garden-sprite-orbit', `garden-sprite-orbit--${safeMood}`, selectedSprite.className)}
            style={{ transform: `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)` }}
        >
            {isInfoOpen ? (
                <div className="garden-sprite-bubble garden-sprite-bubble--compact">
                    <span className="font-bold text-primary truncate">{selectedSprite.label}</span>
                    <span className="text-outline">{movementLabel}</span>
                    <button type="button" onClick={() => setIsInfoOpen(false)} className="garden-sprite-mini-button" title="Hide character info">
                        <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                </div>
            ) : (
                <button type="button" onClick={() => setIsInfoOpen(true)} className="garden-sprite-pill" title="Show character info">
                    <span className="material-symbols-outlined text-[12px]">info</span>
                </button>
            )}

            <button
                type="button"
                className={clsx('spirit-mascot-button', `spirit-mascot-button--${safeMood}`)}
                onClick={onClick}
                aria-label={`${selectedSprite.label} is ${statusLabel}`}
                title={`${selectedSprite.label} is ${statusLabel}`}
            >
                <span className="spirit-mascot-glow" />
                <span className="spirit-mascot-mote spirit-mascot-mote--one" />
                <span className="spirit-mascot-mote spirit-mascot-mote--two" />
                <span className="spirit-mascot-mote spirit-mascot-mote--three" />
                <span className="spirit-mascot-leaf spirit-mascot-leaf--left" />
                <span className="spirit-mascot-leaf spirit-mascot-leaf--right" />
                <span className="spirit-mascot-sprig" />
                <span className="spirit-mascot-body">
                    <span className="spirit-mascot-shine" />
                    <span className="spirit-mascot-belly" />
                    <span className="spirit-mascot-face">
                        <span className="spirit-mascot-eye spirit-mascot-eye--left">
                            <span className="spirit-mascot-pupil" />
                        </span>
                        <span className="spirit-mascot-eye spirit-mascot-eye--right">
                            <span className="spirit-mascot-pupil" />
                        </span>
                        <span className="spirit-mascot-mouth" />
                        <span className="spirit-mascot-cheek spirit-mascot-cheek--left" />
                        <span className="spirit-mascot-cheek spirit-mascot-cheek--right" />
                    </span>
                </span>
                <span className="spirit-mascot-shadow" />
            </button>

            <span className="sr-only">
                {telemetryMood === 'critical' || telemetryMood === 'struggling'
                    ? 'The plant telemetry suggests a careful mood.'
                    : 'The screen character is active.'}
            </span>
        </div>
    );
}
