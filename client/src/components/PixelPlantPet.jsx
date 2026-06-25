import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

const SPRITE_BODIES = [
    {
        id: 'sprout',
        label: 'Sprout Signal',
        archetype: 'curious scout',
        note: 'Follows close, tilts toward your cursor, and reacts with bright alert eyes.',
        vibe: 'Fast, curious, helpful',
        className: 'garden-sprite--sprout',
        followSpeed: 0.085,
        mobileSpeed: 0.035,
        wanderMs: 3600,
        pointerOffset: { x: 36, y: 24 },
        idleActs: ['peek', 'hop', 'scan', 'wave'],
        voiceLine: 'I notice little changes first.',
        petAction: 'curious-hop',
        behavior: 'dart',
        settleBias: 'top',
        bubbleLines: {
            idle: ['I spotted a tiny signal shift.', 'Cursor trail logged. Very scientific.'],
            listening: ['I am leaning in.', 'Mic leaf is open.'],
            thinking: ['Scanning the stream...', 'Let me peek at that thought.'],
            speaking: ['Translating leaf feelings.', 'Tiny broadcast mode.'],
            comforting: ['I can stay nearby.', 'Soft scout mode.'],
            concerned: ['Something feels off. I am watching it.'],
            petted: ['Boop received. Signal brighter.', 'I hopped. Professionally.', 'That felt warm. I am staying close.', 'Tiny leaf happy. Thank you.']
        }
    },
    {
        id: 'moss',
        label: 'Moss Byte',
        archetype: 'soft guardian',
        note: 'Moves slowly, naps often, and becomes extra gentle during emotional moments.',
        vibe: 'Calm, cozy, patient',
        className: 'garden-sprite--moss',
        followSpeed: 0.032,
        mobileSpeed: 0.018,
        wanderMs: 8200,
        pointerOffset: { x: 42, y: 38 },
        idleActs: ['doze', 'breathe', 'nuzzle', 'peek'],
        voiceLine: 'I stay close without rushing you.',
        petAction: 'soft-nuzzle',
        behavior: 'drift',
        settleBias: 'bottom',
        bubbleLines: {
            idle: ['I found a quiet corner.', 'No rush. I am here.'],
            listening: ['Slow ears, fully open.', 'I am listening softly.'],
            thinking: ['Let it settle a second.', 'Moss brain loading gently.'],
            speaking: ['Small voice, steady roots.', 'I will keep it soft.'],
            comforting: ['Come sit by the moss.', 'We can be quiet together.'],
            concerned: ['I am keeping watch gently.'],
            petted: ['That was warm. I am all soft now.', 'I will nuzzle the moment.', 'I liked that. Staying beside you.', 'A gentle pat is exactly my speed.']
        }
    },
    {
        id: 'bloom',
        label: 'Bloom Dot',
        archetype: 'tiny performer',
        note: 'Bounces, sparkles, celebrates replies, and gets dramatic when the mood shifts.',
        vibe: 'Expressive, bright, theatrical',
        className: 'garden-sprite--bloom',
        followSpeed: 0.095,
        mobileSpeed: 0.04,
        wanderMs: 3000,
        pointerOffset: { x: 30, y: 14 },
        idleActs: ['sparkle', 'twirl', 'hop', 'ta-da'],
        voiceLine: 'I turn small moments into a scene.',
        petAction: 'star-pop',
        behavior: 'bounce',
        settleBias: 'center',
        bubbleLines: {
            idle: ['Tiny stage lights on.', 'I rehearsed a sparkle.'],
            listening: ['Ooh, live scene.', 'Say the line. I am ready.'],
            thinking: ['Dramatic pause...', 'Plotting a beautiful reply.'],
            speaking: ['And now, the leaf monologue.', 'Cue the tiny sparkle.'],
            comforting: ['Soft scene. Gentle lighting.', 'I can dim the sparkle.'],
            concerned: ['The vibe got wobbly. I noticed.'],
            petted: ['Applause accepted.', 'I popped. Naturally.', 'That was lovely. I am sparkling politely.', 'Tiny applause in my chest.', 'You made my petals grin.']
        }
    },
    {
        id: 'cactus',
        label: 'Prickle Ping',
        archetype: 'watchful rebel',
        note: 'Keeps distance, squints at nonsense, and gives stubborn little jumps.',
        vibe: 'Dry-witty, resilient, alert',
        className: 'garden-sprite--cactus',
        followSpeed: 0.042,
        mobileSpeed: 0.023,
        wanderMs: 6400,
        pointerOffset: { x: -112, y: 26 },
        idleActs: ['squint', 'guard', 'hop', 'stretch'],
        voiceLine: 'I care, but I will pretend it was tactical.',
        petAction: 'prickle-recoil',
        behavior: 'guard',
        settleBias: 'edge',
        bubbleLines: {
            idle: ['I am guarding the pixels.', 'Totally not attached.'],
            listening: ['Fine. I am listening.', 'Mic perimeter active.'],
            thinking: ['Assessing. Calmly.', 'I will allow one thought.'],
            speaking: ['Delivering a very serious ping.', 'Leaf report, but with boundaries.'],
            comforting: ['I will stand guard nearby.', 'No drama. Just backup.'],
            concerned: ['Hmm. That reading deserves a squint.'],
            petted: ['Careful. Spikes have feelings.', 'I recoiled affectionately.', 'That was... fine. Also warm.', 'I liked that, but tell no one.', 'I am prickly, not heartless.']
        }
    }
];

const MOOD_LABELS = {
    idle: 'calm',
    wander: 'wandering',
    follow: 'following',
    curious: 'curious',
    petted: 'petted',
    listening: 'listening',
    thinking: 'thinking',
    speaking: 'speaking',
    happy: 'bright',
    comforting: 'soft',
    concerned: 'careful'
};

const SETTLE_ZONE_PADDING = 18;
const PET_SIZE = { width: 116, height: 116 };

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getViewportBounds() {
    if (typeof window === 'undefined') return { width: 1024, height: 720 };
    return { width: window.innerWidth, height: window.innerHeight };
}

function elementFromSelector(selector) {
    if (typeof document === 'undefined') return null;
    try {
        return document.querySelector(selector);
    } catch {
        return null;
    }
}

function rectFromElement(selector) {
    const element = elementFromSelector(selector);
    return element ? element.getBoundingClientRect() : null;
}

function getSafeBounds() {
    const { width, height } = getViewportBounds();
    const topHeader = rectFromElement('.glass-card .bg-white\\/50') || rectFromElement('header');
    const formElement = elementFromSelector('form');
    const inputBar = formElement?.closest?.('.shrink-0')?.getBoundingClientRect?.() || formElement?.getBoundingClientRect?.();
    const drawer = rectFromElement('.fixed.md\\:relative') || rectFromElement('[class*="md:w-[24rem]"]');

    const top = Math.max(78, (topHeader?.bottom || 74) + 16);
    const bottomBlock = inputBar ? height - inputBar.top + 18 : 136;
    const bottom = Math.max(142, bottomBlock);
    const rightBlock = drawer && drawer.left > width * 0.55 ? width - drawer.left + 20 : 12;

    return {
        left: 14,
        top,
        right: Math.max(132, width - rightBlock - PET_SIZE.width),
        bottom: Math.max(top + 120, height - bottom - PET_SIZE.height)
    };
}

function avoidBlockedZones(point) {
    const { width, height } = getViewportBounds();
    const safe = getSafeBounds();
    const catalogueOpen = Boolean(rectFromElement('.garden-sprite-panel'));
    const statsDrawer = rectFromElement('.fixed.md\\:relative') || rectFromElement('[class*="md:w-[24rem]"]');
    const formElement = elementFromSelector('form');
    const inputBar = formElement?.closest?.('.shrink-0')?.getBoundingClientRect?.();

    let x = clamp(point.x, safe.left, safe.right);
    let y = clamp(point.y, safe.top, safe.bottom);

    if (inputBar && y + PET_SIZE.height > inputBar.top - 14) {
        y = clamp(inputBar.top - PET_SIZE.height - 22, safe.top, safe.bottom);
    }

    if (statsDrawer && statsDrawer.left < width && statsDrawer.left > width * 0.48 && x + PET_SIZE.width > statsDrawer.left - 8) {
        x = clamp(statsDrawer.left - PET_SIZE.width - 24, safe.left, safe.right);
    }

    if (catalogueOpen) {
        x = clamp(SETTLE_ZONE_PADDING, safe.left, Math.min(safe.right, width * 0.55));
        y = clamp(y, safe.top, Math.min(safe.bottom, height - 230));
    }

    return { x, y };
}

function pickSettlePoint(sprite) {
    const { width, height } = getViewportBounds();
    const safe = getSafeBounds();
    const isMobile = width < 640;
    const zones = isMobile
        ? [
            { x: safe.left + 8, y: safe.top + 36 },
            { x: safe.right - 4, y: safe.top + 82 },
            { x: safe.left + 16, y: safe.bottom - 12 }
        ]
        : [
            { x: safe.left + 20, y: safe.top + 24 },
            { x: safe.right - 10, y: safe.top + 38 },
            { x: safe.left + 24, y: safe.bottom - 20 },
            { x: safe.right - 18, y: safe.bottom - 12 },
            { x: width * 0.5 - 58, y: safe.top + Math.max(70, (height - safe.top - (height - safe.bottom)) * 0.24) }
        ];

    let candidates = zones;
    if (sprite.settleBias === 'top') candidates = zones.slice(0, 2);
    if (sprite.settleBias === 'bottom') candidates = [zones[2], zones[3] || zones[1]];
    if (sprite.settleBias === 'edge') candidates = [zones[0], zones[3] || zones[1], zones[2]];
    if (sprite.settleBias === 'center') candidates = [zones[4] || zones[1], zones[1], zones[3] || zones[2]];

    const choice = candidates[Math.floor(Math.random() * candidates.length)] || zones[0];
    const jitter = sprite.behavior === 'drift' ? 16 : sprite.behavior === 'bounce' ? 36 : 26;
    return avoidBlockedZones({
        x: choice.x + (Math.random() - 0.5) * jitter,
        y: choice.y + (Math.random() - 0.5) * jitter
    });
}

function getTypingDockPoint(typingText = '') {
    const formElement = elementFromSelector('form');
    const inputElement = formElement?.querySelector?.('input[name="message"]');
    const rect = inputElement?.getBoundingClientRect?.() || formElement?.getBoundingClientRect?.();
    if (!rect) return pickSettlePoint(SPRITE_BODIES[0]);

    let caretX = rect.right - 62;
    if (inputElement) {
        const computed = window.getComputedStyle(inputElement);
        const paddingLeft = Number.parseFloat(computed.paddingLeft || '20') || 20;
        const paddingRight = Number.parseFloat(computed.paddingRight || '48') || 48;
        const caretIndex = typeof inputElement.selectionStart === 'number'
            ? inputElement.selectionStart
            : String(typingText).length;
        const visibleText = String(inputElement.value || typingText).slice(0, caretIndex);
        const canvas = getTypingDockPoint.canvas || document.createElement('canvas');
        getTypingDockPoint.canvas = canvas;
        const context = canvas.getContext('2d');
        if (context) {
            context.font = `${computed.fontStyle || 'normal'} ${computed.fontVariant || 'normal'} ${computed.fontWeight || '400'} ${computed.fontSize || '14px'} ${computed.fontFamily || 'sans-serif'}`;
            const measured = context.measureText(visibleText || ' ').width;
            caretX = rect.left + paddingLeft + measured - (inputElement.scrollLeft || 0) + 10;
        }
        caretX = clamp(caretX, rect.left + paddingLeft + 10, rect.right - paddingRight + 16);
    }

    const { width, height } = getViewportBounds();
    const scaleWidth = width < 640 ? 46 : 54;
    return {
        x: clamp(caretX + 4, 12, width - scaleWidth - 10),
        y: clamp(rect.top - 54, 82, height - 168)
    };
}

function getTelemetryTip(metrics, selectedSprite, safeMood) {
    const moisture = Number(metrics?.moisture ?? 50);
    const sunlight = Number(metrics?.sunlight ?? 50);
    const temp = Number(metrics?.temperature ?? 24);
    const soil = Number(metrics?.soil_health ?? 60);

    if (safeMood === 'listening') return selectedSprite.bubbleLines.listening[0];
    if (safeMood === 'thinking') return selectedSprite.bubbleLines.thinking[0];
    if (safeMood === 'speaking') return selectedSprite.bubbleLines.speaking[0];
    if (safeMood === 'comforting') return selectedSprite.bubbleLines.comforting[0];
    if (safeMood === 'concerned') return selectedSprite.bubbleLines.concerned[0];

    if (moisture < 30) return 'Tiny care nudge: the soil feels thirsty.';
    if (sunlight < 35) return 'A brighter spot might help today.';
    if (temp > 31) return 'It feels a bit fever-warm here.';
    if (temp < 16) return 'I am sensing a chilly little corner.';
    if (soil < 40) return 'Roots could use a gentler routine.';
    return selectedSprite.bubbleLines.idle[Math.floor(Math.random() * selectedSprite.bubbleLines.idle.length)];
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
    isUserTyping = false,
    typingText = '',
    onClick
}) {
    const safeMood = MOOD_LABELS[mood] ? mood : 'idle';
    const selectedSprite = useMemo(
        () => SPRITE_BODIES.find(item => item.id === selectedSpriteId) || SPRITE_BODIES[0],
        [selectedSpriteId]
    );
    const [position, setPosition] = useState({ x: 28, y: 32 });
    const [idleAct, setIdleAct] = useState(null);
    const [isPetted, setIsPetted] = useState(false);
    const [petAction, setPetAction] = useState(null);
    const [lookDirection, setLookDirection] = useState('center');
    const [movementMode, setMovementMode] = useState('wander');
    const [bubble, setBubble] = useState(null);
    const [typingDocked, setTypingDocked] = useState(false);
    const positionRef = useRef(position);
    const targetRef = useRef(position);
    const pointerModeRef = useRef(false);
    const idleActTimeoutRef = useRef(null);
    const petTimeoutRef = useRef(null);
    const bubbleTimeoutRef = useRef(null);
    const moodBubbleTimeoutRef = useRef(null);
    const typingReleaseTimeoutRef = useRef(null);
    const telemetryMood = String(metrics?.mood || 'stable').toLowerCase();
    const statusLabel = muted ? 'quiet' : MOOD_LABELS[safeMood];

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    const showBubble = (text, variant = 'tip', duration = 2600) => {
        if (!text || typeof window === 'undefined') return;
        if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
        setBubble({ text, variant, id: Date.now() });
        bubbleTimeoutRef.current = window.setTimeout(() => setBubble(null), duration);
    };

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const initial = pickSettlePoint(selectedSprite);
        setPosition(initial);
        targetRef.current = initial;
        return undefined;
    }, [selectedSprite]);

    useEffect(() => {
        if (!selectedSpriteId || typeof window === 'undefined') return undefined;
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
        const isMobile = window.innerWidth < 640;
        let pointerReleaseId;
        let settleId;

        const settle = () => {
            if (pointerModeRef.current || isUserTyping) return;
            targetRef.current = pickSettlePoint(selectedSprite);
            setMovementMode('wander');
        };

        const setTargetNearPointer = (event) => {
            if (!canHover || prefersReducedMotion) return;
            const current = positionRef.current;
            const mascotCenter = { x: current.x + 58, y: current.y + 58 };
            const distance = Math.hypot(event.clientX - mascotCenter.x, event.clientY - mascotCenter.y);
            const pettableRadius = selectedSprite.id === 'cactus' ? 96 : 88;

            if (distance < pettableRadius) {
                pointerModeRef.current = true;
                targetRef.current = current;
                setMovementMode('curious');
                setLookDirection(event.clientX < mascotCenter.x ? 'left' : 'right');
                if (pointerReleaseId) window.clearTimeout(pointerReleaseId);
                pointerReleaseId = window.setTimeout(() => {
                    pointerModeRef.current = false;
                    setMovementMode('wander');
                    setLookDirection('center');
                }, selectedSprite.id === 'moss' ? 2600 : 1900);
                return;
            }

            pointerModeRef.current = true;
            setMovementMode('follow');
            if (pointerReleaseId) window.clearTimeout(pointerReleaseId);
            pointerReleaseId = window.setTimeout(() => {
                pointerModeRef.current = false;
                setMovementMode('wander');
                setLookDirection('center');
            }, selectedSprite.id === 'moss' ? 2600 : 1700);

            const edgeOffsetX = event.clientX > window.innerWidth - 210 ? -126 : selectedSprite.pointerOffset.x;
            const offsetY = event.clientY > window.innerHeight - 180 ? -116 : selectedSprite.pointerOffset.y;
            const target = avoidBlockedZones({
                x: event.clientX + edgeOffsetX,
                y: event.clientY + offsetY
            });
            targetRef.current = target;
            setLookDirection(edgeOffsetX < 0 ? 'left' : 'right');
        };

        let frameId;
        const animate = () => {
            const current = positionRef.current;
            const target = prefersReducedMotion
                ? pickSettlePoint(selectedSprite)
                : (isUserTyping || typingDocked ? targetRef.current : avoidBlockedZones(targetRef.current));
            const speedBase = isMobile ? selectedSprite.mobileSpeed : selectedSprite.followSpeed;
            const moodBoost = safeMood === 'listening' || safeMood === 'happy' ? 1.15 : 1;
            const next = {
                x: current.x + (target.x - current.x) * Math.min(0.14, speedBase * moodBoost),
                y: current.y + (target.y - current.y) * Math.min(0.14, speedBase * moodBoost)
            };
            positionRef.current = next;
            setPosition(next);
            if (!prefersReducedMotion) frameId = window.requestAnimationFrame(animate);
        };

        if (prefersReducedMotion) {
            const initial = pickSettlePoint(selectedSprite);
            setPosition(initial);
            targetRef.current = initial;
            setMovementMode('idle');
            return undefined;
        }

        settleId = window.setInterval(settle, isMobile ? selectedSprite.wanderMs * 1.8 : selectedSprite.wanderMs);
        window.addEventListener('pointermove', setTargetNearPointer, { passive: true });
        window.addEventListener('resize', settle, { passive: true });
        frameId = window.requestAnimationFrame(animate);
        settle();

        return () => {
            window.removeEventListener('pointermove', setTargetNearPointer);
            window.removeEventListener('resize', settle);
            window.clearInterval(settleId);
            if (pointerReleaseId) window.clearTimeout(pointerReleaseId);
            window.cancelAnimationFrame(frameId);
        };
    }, [selectedSprite, selectedSpriteId, safeMood, isUserTyping]);

    useEffect(() => {
        if (!selectedSpriteId || typeof window === 'undefined') return undefined;

        if (typingReleaseTimeoutRef.current) window.clearTimeout(typingReleaseTimeoutRef.current);

        if (isUserTyping) {
            pointerModeRef.current = true;
            setTypingDocked(true);
            setMovementMode('typing');
            setLookDirection('right');
            targetRef.current = getTypingDockPoint(typingText);
            return undefined;
        }

        if (typingDocked) {
            typingReleaseTimeoutRef.current = window.setTimeout(() => {
                pointerModeRef.current = false;
                setTypingDocked(false);
                setMovementMode('wander');
                targetRef.current = pickSettlePoint(selectedSprite);
            }, selectedSprite.id === 'moss' ? 180 : 120);
        }

        return () => {
            if (typingReleaseTimeoutRef.current) window.clearTimeout(typingReleaseTimeoutRef.current);
        };
    }, [isUserTyping, typingText, selectedSprite, selectedSpriteId, typingDocked]);

    useEffect(() => {
        if (!selectedSpriteId || safeMood !== 'idle' || typeof window === 'undefined') {
            setIdleAct(null);
            if (idleActTimeoutRef.current) window.clearTimeout(idleActTimeoutRef.current);
            return undefined;
        }

        let cancelled = false;
        const scheduleIdleAct = () => {
            const wait = (selectedSprite.id === 'bloom' ? 2100 : 3200) + Math.random() * (selectedSprite.id === 'moss' ? 7600 : 4400);
            idleActTimeoutRef.current = window.setTimeout(() => {
                if (cancelled) return;
                const acts = selectedSprite.idleActs || ['peek'];
                const nextAct = acts[Math.floor(Math.random() * acts.length)];
                setIdleAct(nextAct);
                setMovementMode(nextAct === 'guard' || nextAct === 'doze' ? 'idle' : 'curious');

                const actLength = ['doze', 'breathe', 'guard'].includes(nextAct) ? 2100 : 1160;
                idleActTimeoutRef.current = window.setTimeout(() => {
                    if (cancelled) return;
                    setIdleAct(null);
                    setMovementMode('wander');
                    scheduleIdleAct();
                }, actLength);
            }, wait);
        };

        scheduleIdleAct();

        return () => {
            cancelled = true;
            if (idleActTimeoutRef.current) window.clearTimeout(idleActTimeoutRef.current);
        };
    }, [safeMood, selectedSprite, selectedSpriteId]);

    useEffect(() => {
        if (!selectedSpriteId || typeof window === 'undefined') return undefined;
        if (!['listening', 'thinking', 'speaking', 'comforting', 'concerned'].includes(safeMood)) return undefined;
        if (moodBubbleTimeoutRef.current) window.clearTimeout(moodBubbleTimeoutRef.current);
        moodBubbleTimeoutRef.current = window.setTimeout(() => {
            showBubble(getTelemetryTip(metrics, selectedSprite, safeMood), safeMood, safeMood === 'comforting' ? 3400 : 2200);
        }, safeMood === 'speaking' ? 320 : 160);
        return () => {
            if (moodBubbleTimeoutRef.current) window.clearTimeout(moodBubbleTimeoutRef.current);
        };
    }, [safeMood, selectedSprite, selectedSpriteId, metrics]);

    const handleMascotClick = (event) => {
        setIsPetted(true);
        setMovementMode('petted');
        setPetAction(selectedSprite.petAction || 'curious-hop');
        showBubble(
            selectedSprite.bubbleLines.petted[Math.floor(Math.random() * selectedSprite.bubbleLines.petted.length)],
            'petted',
            2800
        );
        if (petTimeoutRef.current) window.clearTimeout(petTimeoutRef.current);
        petTimeoutRef.current = window.setTimeout(() => {
            setIsPetted(false);
            setPetAction(null);
            setMovementMode('wander');
        }, 980);
        onClick?.(event);
    };

    useEffect(() => () => {
        if (petTimeoutRef.current) window.clearTimeout(petTimeoutRef.current);
        if (bubbleTimeoutRef.current) window.clearTimeout(bubbleTimeoutRef.current);
        if (moodBubbleTimeoutRef.current) window.clearTimeout(moodBubbleTimeoutRef.current);
        if (typingReleaseTimeoutRef.current) window.clearTimeout(typingReleaseTimeoutRef.current);
    }, []);

    if (!selectedSpriteId) return null;

    return (
        <div
            className={clsx(
                'garden-sprite-orbit',
                `garden-sprite-orbit--${safeMood}`,
                selectedSprite.className,
                `garden-sprite-look--${lookDirection}`,
                `garden-sprite-motion--${movementMode}`,
                typingDocked && 'garden-sprite-orbit--typing-docked',
                bubble && 'garden-sprite-orbit--has-bubble'
            )}
            style={{ transform: `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)` }}
        >
            {bubble && (
                <span className={clsx('garden-sprite-thought', `garden-sprite-thought--${bubble.variant}`)} role="status">
                    {bubble.text}
                </span>
            )}
            <button
                type="button"
                className={clsx(
                    'spirit-mascot-button',
                    `spirit-mascot-button--${safeMood}`,
                    isPetted && 'spirit-mascot-button--petted',
                    isPetted && petAction && `spirit-mascot-button--pet-${petAction}`,
                    safeMood === 'idle' && idleAct && `spirit-mascot-button--act-${idleAct}`
                )}
                onClick={handleMascotClick}
                aria-label={`${selectedSprite.label} is ${statusLabel}. Tap for a small local reaction.`}
                title={`${selectedSprite.label} is ${statusLabel}`}
            >
                <span className="spirit-mascot-glow" />
                <span className="spirit-mascot-mote spirit-mascot-mote--one" />
                <span className="spirit-mascot-mote spirit-mascot-mote--two" />
                <span className="spirit-mascot-mote spirit-mascot-mote--three" />
                <span className="spirit-mascot-tail" />
                <span className="spirit-mascot-ear spirit-mascot-ear--left" />
                <span className="spirit-mascot-ear spirit-mascot-ear--right" />
                <span className="spirit-mascot-leaf spirit-mascot-leaf--left" />
                <span className="spirit-mascot-leaf spirit-mascot-leaf--right" />
                <span className="spirit-mascot-sprig" />
                <span className="spirit-mascot-body">
                    <span className="spirit-mascot-shine" />
                    <span className="spirit-mascot-belly" />
                    <span className="spirit-mascot-face">
                        <span className="spirit-mascot-brow spirit-mascot-brow--left" />
                        <span className="spirit-mascot-brow spirit-mascot-brow--right" />
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

