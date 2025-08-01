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
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading rooms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 w-full">
      {/* Create New Room Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white">✨</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Create New Room</h2>
          <p className="text-gray-600">Start a new collaborative session</p>
        </div>
        
        <form onSubmit={handleCreateRoom} className="space-y-6">
          <div>
            <label htmlFor="roomName" className="block text-sm font-semibold text-gray-700 mb-2">
              Room Name
            </label>
            <input
              type="text"
              id="roomName"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter a creative room name"
              required
            />
          </div>
          
          <div>
            <label htmlFor="userName" className="block text-sm font-semibold text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter your name"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Create Room
          </button>
        </form>
      </div>

      {/* Join Existing Room Card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white">🚀</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Join Existing Room</h2>
          <p className="text-gray-600">Connect with your team</p>
        </div>
        
        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📝</span>
            </div>
            <p className="text-gray-500 text-lg mb-2">No rooms available</p>
            <p className="text-gray-400">Create a new room to get started!</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label htmlFor="joinUserName" className="block text-sm font-semibold text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                id="joinUserName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter your name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Select a Room</label>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedRoom?.id === room.id
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 mb-1">{room.name}</h3>
                        <p className="text-sm text-gray-600">Created by {room.createdBy}</p>
                      </div>
                      <div className="text-xs text-gray-400 bg-white px-2 py-1 rounded-full">
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
              className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-green-700 hover:to-teal-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
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