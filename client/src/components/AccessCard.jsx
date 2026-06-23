import { API_URL } from '../utils/api';
import { useState } from 'react';


export default function AccessCard({ onAccess }) {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Could not access companion device.');
            }

            onAccess(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[74vh] grid md:grid-cols-[1fr_420px] gap-8 items-center py-8 animate-[fadeIn_1s_ease-out]">
            <section className="hidden md:flex flex-col justify-center min-h-[520px] rounded-[2rem] overflow-hidden glass-card mist-shadow relative border border-white/30 p-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(57,105,49,0.14),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(140,79,16,0.10),transparent_28%)]" />
                <div className="relative z-10 max-w-lg">
                    <span className="text-[10px] uppercase tracking-[0.32em] text-outline font-bold">IoT Companion MVP</span>
                    <h1 className="font-display text-5xl font-bold text-on-surface mt-4 leading-tight">
                        Access your plant device.
                    </h1>
                    <p className="text-sm text-on-surface-variant mt-4 leading-relaxed max-w-md">
                        AMIGDA binds a simple account to one simulated telemetry stream, so your companion remembers its plant, persona, and sensor feed across tabs.
                    </p>
                </div>

                <div className="relative z-10 mt-10 grid grid-cols-3 gap-3 max-w-lg">
                    {[
                        ['Moisture', '74%', 'water_drop'],
                        ['Light', 'Stable', 'wb_sunny'],
                        ['Voice', 'Ready', 'graphic_eq']
                    ].map(([label, value, icon]) => (
                        <div key={label} className="bg-white/55 border border-white/40 rounded-2xl p-4 shadow-sm">
                            <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
                            <div className="text-[10px] text-outline uppercase tracking-wider font-bold mt-2">{label}</div>
                            <div className="font-display text-lg font-bold text-on-surface">{value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="glass-card mist-shadow w-full rounded-[2rem] p-7 md:p-8 border border-white/30">
                <div className="text-center mb-7">
                    <div className="w-16 h-16 mx-auto rounded-3xl bg-primary/10 flex items-center justify-center mb-4 shadow-inner">
                        <span className="material-symbols-outlined text-primary text-3xl">sensors</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.28em] text-outline font-bold">
                        Companion Device Access
                    </span>
                    <h2 className="font-display text-3xl font-bold text-on-surface mt-2">
                        {mode === 'login' ? 'Welcome back' : 'Create access'}
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                        {mode === 'login'
                            ? 'Open your saved companion and telemetry stream.'
                            : 'Create a simple MVP profile, then provision your first plant.'}
                    </p>
                </div>

                <div className="grid grid-cols-2 bg-white/50 rounded-full p-1 mb-6 border border-outline-variant/30">
                    <button
                        type="button"
                        onClick={() => {
                            setMode('login');
                            setError('');
                        }}
                        className={`py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${mode === 'login' ? 'bg-primary text-white shadow-sm' : 'text-outline hover:text-primary'}`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode('create');
                            setError('');
                        }}
                        className={`py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${mode === 'create' ? 'bg-primary text-white shadow-sm' : 'text-outline hover:text-primary'}`}
                    >
                        Create
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
                            Access Name
                        </label>
                        <input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            minLength={2}
                            autoComplete="username"
                            placeholder="e.g. priya"
                            className="w-full bg-white/70 border border-outline-variant rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
                            Device Passphrase
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={2}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            placeholder="Simple MVP password"
                            className="w-full bg-white/70 border border-outline-variant rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-critical/15 bg-critical/5 px-4 py-3 text-xs font-medium text-critical">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!username.trim() || !password || isLoading}
                        className="w-full bg-primary text-white py-3 rounded-full font-bold shadow-lg shadow-primary/15 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {isLoading ? 'Checking Device...' : mode === 'login' ? 'Open Companion' : 'Create Device Profile'}
                    </button>
                </form>
            </section>
        </div>
    );
}
