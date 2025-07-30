import React, { useState } from 'react';
import './App.css';
import RoomList from './components/RoomList';
import Whiteboard from './components/Whiteboard';
import { Room } from './types/whiteboard';

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
    <div className="App min-h-screen bg-gray-100">
      {!currentRoom ? (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
              Real-Time Whiteboard
            </h1>
            <p className="text-center text-gray-600 mb-8">
              Collaborate in real-time with multiple users on a shared whiteboard
            </p>
            <RoomList onJoinRoom={handleJoinRoom} />
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
  );
}

export default App;
