const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface CreateRoomResponse {
  success: boolean;
  room: {
    id: string;
    name: string;
    roomId: string;
    createdBy: string;
    createdAt: string;
    elements?: any[];
  };
}

export interface GetRoomsResponse {
  success: boolean;
  rooms: Array<{
    id: string;
    name: string;
    roomId: string;
    createdBy: string;
    createdAt: string;
    elements?: any[];
  }>;
}

export interface GetRoomResponse {
  success: boolean;
  room: {
    id: string;
    name: string;
    roomId: string;
    createdBy: string;
    createdAt: string;
    elements?: any[];
  };
}

export const createRoom = async (name: string, createdBy: string): Promise<CreateRoomResponse> => {
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, createdBy }),
  });

  if (!response.ok) {
    throw new Error('Failed to create room');
  }

  return response.json();
};

export const getRooms = async (): Promise<GetRoomsResponse> => {
  const response = await fetch(`${API_BASE_URL}/rooms`);

  if (!response.ok) {
    throw new Error('Failed to fetch rooms');
  }

  return response.json();
};

export const getRoom = async (roomId: string): Promise<GetRoomResponse> => {
  const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch room');
  }

  return response.json();
}; 