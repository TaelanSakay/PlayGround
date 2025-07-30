import React, { useState, useEffect } from 'react';
import { Room } from '../types/whiteboard';
import { createRoom, getRooms } from '../services/api';

interface RoomListProps {
  onJoinRoom: (room: Room, userName: string) => void;
}

const RoomList: React.FC<RoomListProps> = ({ onJoinRoom }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await getRooms();
      setRooms(response.rooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !userName.trim()) return;

    try {
      const response = await createRoom(newRoomName, userName);
      onJoinRoom(response.room, userName);
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const handleJoinRoom = () => {
    if (selectedRoom && userName.trim()) {
      onJoinRoom(selectedRoom, userName);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Room Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Create New Room</h2>
        <form onSubmit={handleCreateRoom} className="space-y-4">
          <div>
            <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
              Room Name
            </label>
            <input
              type="text"
              id="roomName"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter room name"
              required
            />
          </div>
          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Create Room
          </button>
        </form>
      </div>

      {/* Join Existing Room Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Join Existing Room</h2>
        
        {rooms.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No rooms available. Create a new room to get started!</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="joinUserName" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                id="joinUserName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select a Room</label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedRoom?.id === room.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-gray-800">{room.name}</h3>
                        <p className="text-sm text-gray-500">Created by {room.createdBy}</p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(room.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={!selectedRoom || !userName.trim()}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList; 