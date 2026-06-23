import { useState, useEffect } from 'react';
import AccessCard from './components/AccessCard';
import Onboarding from './components/Onboarding';
import PersonalHub from './components/PersonalHub';
import Dashboard from './components/Dashboard';

const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
const SESSION_KEY = 'symbio_account_v1';
const ROOM_KEY = 'symbio_room_v2';
const ROOM_NAME_KEY = 'symbio_room_name_v2';
const ROOM_META_KEY = 'symbio_room_meta_v2';

function clearRoomStorage() {
  localStorage.removeItem(ROOM_KEY);
  localStorage.removeItem(ROOM_NAME_KEY);
  localStorage.removeItem(ROOM_META_KEY);
}

function App() {
  const [account, setAccount] = useState(null);
  const [user, setUser] = useState(null);
  const [needsPlantSetup, setNeedsPlantSetup] = useState(false);
  const [roomCode, setRoomCode] = useState(null);
  const [roomMeta, setRoomMeta] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const savedUsername = localStorage.getItem(SESSION_KEY);
      const savedRoom = localStorage.getItem(ROOM_KEY);
      const savedRoomMeta = localStorage.getItem(ROOM_META_KEY);

      if (!savedUsername) {
        setIsRestoring(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/session/${encodeURIComponent(savedUsername)}`);
        if (!response.ok) throw new Error('Session expired');

        const data = await response.json();
        setAccount(data.account);
        setUser(data.user || null);
        setNeedsPlantSetup(Boolean(data.needsPlantSetup));
        if (savedRoom && data.user) {
          setRoomCode(savedRoom);
          if (savedRoomMeta) {
            try {
              setRoomMeta(JSON.parse(savedRoomMeta));
            } catch {
              setRoomMeta(null);
            }
          }
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
        clearRoomStorage();
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession();
  }, []);

  const handleAccess = (data) => {
    setAccount(data.account);
    setUser(data.user || null);
    setNeedsPlantSetup(Boolean(data.needsPlantSetup));
    setRoomCode(null);
    setRoomMeta(null);
    localStorage.setItem(SESSION_KEY, data.account.username);
    clearRoomStorage();
  };

  const handlePlantSetup = async (plantProfile) => {
    if (!account?.username) return;

    const response = await fetch(`${API_URL}/api/account/plant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, plantProfile })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save plant companion.');

    setAccount(data.account);
    setUser(data.user);
    setNeedsPlantSetup(false);
  };

  const handleJoinRoom = (code, name = '', meta = null) => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) return;

    const normalizedMeta = meta || (name ? { code: normalizedCode, name } : null);
    setRoomCode(normalizedCode);
    setRoomMeta(normalizedMeta);
    localStorage.setItem(ROOM_KEY, normalizedCode);

    if (normalizedMeta?.name) {
      localStorage.setItem(ROOM_NAME_KEY, normalizedMeta.name);
      localStorage.setItem(ROOM_META_KEY, JSON.stringify(normalizedMeta));
    } else {
      localStorage.removeItem(ROOM_NAME_KEY);
      localStorage.removeItem(ROOM_META_KEY);
    }
  };

  const handleLeaveRoom = () => {
    setRoomCode(null);
    setRoomMeta(null);
    clearRoomStorage();
  };

  const handleLogout = () => {
    setAccount(null);
    setUser(null);
    setNeedsPlantSetup(false);
    setRoomCode(null);
    setRoomMeta(null);
    localStorage.removeItem(SESSION_KEY);
    clearRoomStorage();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col pt-20 px-4 relative overflow-hidden select-none">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-tertiary/5 blur-[120px]"></div>
      </div>

      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-10 h-16 bg-white/30 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2 group cursor-pointer">
          <span className="material-symbols-outlined text-primary text-3xl" data-icon="bubble_chart">bubble_chart</span>
          <span className="font-display text-2xl font-bold text-primary tracking-widest">AMIGDA</span>
        </div>
        {account && (
          <div className="flex items-center gap-3">
            {user ? (
              <span className="text-xs uppercase tracking-widest text-outline font-semibold bg-primary-container/20 text-on-primary-container px-3 py-1 rounded-full">
                {user.name} &amp; {user.persona}
              </span>
            ) : (
              <span className="text-xs uppercase tracking-widest text-outline font-semibold bg-primary-container/20 text-on-primary-container px-3 py-1 rounded-full">
                {account.username}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-full hover:bg-black/5 text-outline hover:text-critical transition-all active:scale-95 cursor-pointer"
              title="Log Out"
            >
              <span className="material-symbols-outlined text-base">logout</span><span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">Sign out</span>
            </button>
          </div>
        )}
      </nav>

      <main className="flex-1 w-full max-w-6xl mx-auto pb-12 relative z-10">
        {isRestoring && (
          <div className="min-h-[70vh] flex items-center justify-center text-xs uppercase tracking-widest text-outline font-bold">
            Reconnecting device access...
          </div>
        )}

        {!isRestoring && !account && <AccessCard onAccess={handleAccess} />}

        {!isRestoring && account && needsPlantSetup && (
          <Onboarding account={account} onComplete={handlePlantSetup} />
        )}

        {!isRestoring && user && !needsPlantSetup && !roomCode && (
          <PersonalHub
            user={user}
            onJoinRoom={handleJoinRoom}
            onLogout={handleLogout}
          />
        )}

        {!isRestoring && user && !needsPlantSetup && roomCode && (
          <Dashboard
            user={user}
            roomCode={roomCode}
            roomMeta={roomMeta}
            onLeave={handleLeaveRoom}
          />
        )}
      </main>
    </div>
  );
}

export default App;
