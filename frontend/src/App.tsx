import { useState } from 'react';
import './App.css';
import RoomList from './components/RoomList';
import Whiteboard from './components/Whiteboard';
import { Room } from './types/whiteboard';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [userName, setUserName] = useState<string>('');

  const handleJoinRoom = (room: Room, name: string) => {
    setCurrentRoom(room);
    setUserName(name);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setUserName('');
  };

  return (
    <NotificationProvider>
      <div className="App min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {!currentRoom ? (
          <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8">
            {/* Modern Header */}
            <div className="text-center mb-12">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 animate-pulse">
                PlayGround Whiteboard 🎨
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Collaborate in real-time with multiple users on a shared whiteboard. 
                Create, draw, and innovate together in a seamless digital workspace.
              </p>
            </div>

            {/* Main Content */}
            <div className="w-full max-w-6xl mx-auto">
              <RoomList onJoinRoom={handleJoinRoom} />
            </div>

            {/* Footer */}
            <div className="mt-16 text-center text-gray-500">
              <p className="text-sm">
                Built with ❤️ for collaborative creativity
              </p>
            </div>
          </div>
        ) : (
          <Whiteboard 
            room={currentRoom} 
            userName={userName}
            onLeaveRoom={handleLeaveRoom}
          />
        )}
      </div>
    </NotificationProvider>
  );
}

export default App;
