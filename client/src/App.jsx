import { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';
import PersonalHub from './components/PersonalHub';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [roomCode, setRoomCode] = useState(null);

  // Load from local storage
  useEffect(() => {
    const savedUser = localStorage.getItem('symbio_user_v2');
    const savedRoom = localStorage.getItem('symbio_room_v2');
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedRoom) setRoomCode(savedRoom);
  }, []);

  const handleOnboard = (userData) => {
    setUser(userData);
    localStorage.setItem('symbio_user_v2', JSON.stringify(userData));
  };

  const handleJoinRoom = (code) => {
    setRoomCode(code);
    localStorage.setItem('symbio_room_v2', code);
  };

  const handleLeaveRoom = () => {
    setRoomCode(null);
    localStorage.removeItem('symbio_room_v2');
  };

  const handleLogout = () => {
    setUser(null);
    setRoomCode(null);
    localStorage.removeItem('symbio_user_v2');
    localStorage.removeItem('symbio_room_v2');
  }

  return (
    <div className="min-h-screen bg-parchment text-ink flex flex-col pt-6 sm:pt-10 px-4">
      <header className="max-w-5xl w-full mx-auto mb-6 flex justify-between items-baseline">
        <div>
          <h1 className="text-3xl font-light text-forest-green tracking-tight">AURA</h1>
          <p className="text-sage text-xs uppercase tracking-widest mt-1 font-semibold">Live Simulation V2</p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto pb-12 relative">
        {!user && <Onboarding onComplete={handleOnboard} />}

        {user && !roomCode && (
          <PersonalHub
            user={user}
            onJoinRoom={handleJoinRoom}
            onLogout={handleLogout}
          />
        )}

        {user && roomCode && (
          <Dashboard
            user={user}
            roomCode={roomCode}
            onLeave={handleLeaveRoom}
          />
        )}
      </main>
    </div>
  );
}

export default App;
