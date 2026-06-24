import { API_URL, SOCKET_URL } from '../utils/api';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';


const FRIENDLY_LOAD_ERROR = 'Oops, the group garden is not reachable right now. Please restart the server and try again.';
const FRIENDLY_CREATE_ERROR = 'Oops, I could not plant that group yet. The server may be down or warming up.';
const FRIENDLY_JOIN_ERROR = 'Oops, I could not find that group code. Check the code and try again.';
const FRIENDLY_PHOTO_ERROR = 'Oops, that photo is too large for this demo card. Try a smaller image or use a photo URL.';
const MAX_PHOTO_BYTES = 1_500_000;

function initials(name = '') {
    return String(name || 'G').trim().slice(0, 2).toUpperCase();
}

async function readApiJson(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return {};

    try {
        return await response.json();
    } catch {
        return {};
    }
}

function friendlyCreateMessage(errorText = '') {
    const normalized = String(errorText).toLowerCase();
    if (normalized.includes('required')) {
        return 'Oops, I still need a group name and a short description.';
    }
    if (normalized.includes('large') || normalized.includes('payload')) {
        return FRIENDLY_PHOTO_ERROR;
    }
    return FRIENDLY_CREATE_ERROR;
}

export default function RoomSetup({ user, onJoin }) {
    const [rooms, setRooms] = useState([]);
    const [roomCode, setRoomCode] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [description, setDescription] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');
    const [copiedCode, setCopiedCode] = useState('');

    const loadRooms = async () => {
        try {
            const response = await fetch(`${API_URL}/api/rooms`);
            const data = await readApiJson(response);
            if (!response.ok) throw new Error(data.error || FRIENDLY_LOAD_ERROR);
            setRooms(data.rooms || []);
        } catch {
            setError(FRIENDLY_LOAD_ERROR);
        }
    };

    useEffect(() => {
        loadRooms();

        const lobbySocket = io(SOCKET_URL);
        lobbySocket.on('rooms_updated', (data) => {
            setRooms(data.rooms || []);
        });

        return () => lobbySocket.disconnect();
    }, []);

    const handleJoin = async (e) => {
        e.preventDefault();
        const normalizedCode = roomCode.trim().toUpperCase();
        if (!normalizedCode) return;

        setError('');
        setIsJoining(true);
        try {
            const response = await fetch(`${API_URL}/api/rooms`);
            const data = await readApiJson(response);
            if (!response.ok) throw new Error(data.error || FRIENDLY_JOIN_ERROR);

            const room = (data.rooms || []).find(item => item.code === normalizedCode);
            if (!room?.code) throw new Error(FRIENDLY_JOIN_ERROR);

            onJoin(room.code, room.name, room);
        } catch {
            setError(FRIENDLY_JOIN_ERROR);
        } finally {
            setIsJoining(false);
        }
    };


    const copyRoomCode = async (code) => {
        const normalizedCode = String(code || '').trim().toUpperCase();
        if (!normalizedCode) return;

        try {
            await navigator.clipboard.writeText(normalizedCode);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = normalizedCode;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }

        setCopiedCode(normalizedCode);
        setTimeout(() => setCopiedCode(''), 1400);
    };

    const handlePhotoFile = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_PHOTO_BYTES) {
            setError(FRIENDLY_PHOTO_ERROR);
            event.target.value = '';
            return;
        }

        setError('');
        const reader = new FileReader();
        reader.onload = () => setPhotoUrl(String(reader.result || ''));
        reader.readAsDataURL(file);
    };

    const handleCreate = async () => {
        setError('');
        setIsCreating(true);

        try {
            const response = await fetch(`${API_URL}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newRoomName,
                    description,
                    photoUrl,
                    createdBy: user?.userId || user?.username || 'unknown'
                })
            });

            const data = await readApiJson(response);
            if (!response.ok || !data.room?.code) throw new Error(data.error || FRIENDLY_CREATE_ERROR);

            await loadRooms();
            onJoin(data.room.code, data.room.name, data.room);
        } catch (err) {
            setError(friendlyCreateMessage(err?.message));
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="w-full space-y-8 animate-[fadeIn_1.2s_ease-out]">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant/30 pb-6">
                <div>
                    <h2 className="font-display text-3xl font-bold text-primary mb-1">Gardening Circles</h2>
                    <p className="text-sm text-on-surface-variant">
                        Create public group sanctuaries where gardeners and plant companions can join the same telemetry chat.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-secondary-container/30 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md self-start">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-on-secondary-container">
                        Public Group Lobby
                    </span>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-error/20 bg-error-container/10 px-4 py-3 text-xs font-bold text-critical">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-4 space-y-6">
                    {!showCreateForm ? (
                        <div className="glass-card mist-shadow rounded-3xl p-6 border-l-4 border-primary space-y-4">
                            <h4 className="font-display text-lg font-bold text-on-surface">Plant a Group</h4>
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                                Name it, describe the vibe, add a photo, and make it visible to other gardeners.
                            </p>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="w-full bg-primary text-white py-3 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-md"
                            >
                                <span className="material-symbols-outlined text-lg">add_circle</span>
                                Create Group
                            </button>
                        </div>
                    ) : (
                        <div className="glass-card mist-shadow rounded-3xl p-6 border-l-4 border-primary space-y-4">
                            <h4 className="font-display text-lg font-bold text-on-surface">Create a Group Sanctuary</h4>
                            <input
                                type="text"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="Group name"
                                className="w-full bg-white/60 border border-outline-variant rounded-2xl px-4 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Subheading or short description"
                                rows={3}
                                className="w-full bg-white/60 border border-outline-variant rounded-2xl px-4 py-2 text-xs resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            <input
                                type="url"
                                value={photoUrl.startsWith('data:') ? '' : photoUrl}
                                onChange={(e) => setPhotoUrl(e.target.value)}
                                placeholder="Photo URL, or upload below"
                                className="w-full bg-white/60 border border-outline-variant rounded-2xl px-4 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            <label className="block rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3 text-center text-[10px] font-bold uppercase tracking-wider text-primary cursor-pointer hover:bg-primary/10 transition-colors">
                                <input type="file" accept="image/*" onChange={handlePhotoFile} className="hidden" />
                                Add Group Photo
                            </label>
                            {photoUrl && (
                                <div className="h-28 rounded-2xl overflow-hidden border border-outline-variant/30 bg-primary/5">
                                    <img src={photoUrl} alt="Group preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreate}
                                    disabled={!newRoomName.trim() || !description.trim() || isCreating}
                                    className="flex-grow bg-primary text-white py-2 rounded-full font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-md disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[14px]">eco</span>
                                    {isCreating ? 'Creating...' : 'Create & Join'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setNewRoomName('');
                                        setDescription('');
                                        setPhotoUrl('');
                                    }}
                                    className="px-4 py-2 border border-outline-variant text-outline rounded-full font-bold text-[10px] uppercase tracking-wider hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="glass-card mist-shadow rounded-3xl p-6 space-y-4">
                        <h4 className="font-display text-lg font-bold text-on-surface">Enter by Code</h4>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            Have an invite code? Type it below to join their greenhouse.
                        </p>
                        <form onSubmit={handleJoin} className="space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value)}
                                    placeholder="GROUP CODE"
                                    className="flex-1 bg-white/50 border border-outline-variant rounded-full px-4 py-2 text-center text-sm font-bold tracking-widest uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    maxLength={8}
                                />
                                <button
                                    type="submit"
                                    disabled={roomCode.trim().length < 3 || isJoining}
                                    className="bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-md"
                                >
                                    <span className="material-symbols-outlined text-lg">{isJoining ? 'sync' : 'arrow_forward'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="md:col-span-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-display text-xl font-bold text-on-surface">Joinable Groups</h4>
                        <button onClick={loadRooms} className="text-xs text-primary font-bold uppercase tracking-widest cursor-pointer hover:opacity-80">
                            Refresh
                        </button>
                    </div>

                    {rooms.length === 0 && (
                        <div className="glass-card mist-shadow rounded-3xl p-8 text-center border border-outline-variant/20">
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto mb-3 flex items-center justify-center">
                                <span className="material-symbols-outlined text-xl">group_off</span>
                            </div>
                            <h5 className="font-display text-lg font-bold text-on-surface">No groups available</h5>
                            <p className="text-xs text-on-surface-variant mt-1">Create a group sanctuary first, then share its code with another user.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {rooms.map((room) => (
                            <div
                                key={room.code}
                                onClick={() => onJoin(room.code, room.name, room)}
                                className="glass-card mist-shadow rounded-3xl p-5 group cursor-pointer hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="min-w-0">
                                            <h5 className="font-bold text-on-surface text-base group-hover:text-primary transition-colors truncate">
                                                {room.name}
                                            </h5>
                                            <p className="text-[11px] text-on-surface-variant font-medium max-h-8 overflow-hidden">
                                                {room.description}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                copyRoomCode(room.code);
                                            }}
                                            className="bg-primary-container/20 text-on-primary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 hover:bg-primary hover:text-white transition-colors cursor-pointer"
                                            title="Copy group code"
                                        >
                                            {copiedCode === room.code ? 'Copied' : room.code}
                                        </button>
                                    </div>
                                    <div className="relative h-28 w-full rounded-2xl overflow-hidden shadow-inner bg-primary/10 flex items-center justify-center">
                                        {room.photoUrl ? (
                                            <img
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                alt={room.name}
                                                src={room.photoUrl}
                                            />
                                        ) : (
                                            <span className="font-display text-3xl font-bold text-primary/50">{initials(room.name)}</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/10"></div>
                                        <div className="absolute bottom-3 left-3 flex -space-x-1.5">
                                            {[0, 1, 2].map((i) => (
                                                <div
                                                    key={i}
                                                    className="w-3.5 h-3.5 rounded-full orb-glow bg-primary shadow-[0_0_6px_rgba(57,105,49,0.3)]"
                                                    style={{ animationDelay: `${i * 0.4}s` }}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-4">
                                    <span className="text-[11px] text-on-surface-variant font-medium">
                                        {room.activeCount || 0} Active
                                    </span>
                                    <span className="text-primary text-xs font-bold flex items-center gap-1 group-hover:gap-1.5 transition-all">
                                        Join Group
                                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
