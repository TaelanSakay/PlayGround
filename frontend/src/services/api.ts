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
  console.log('Creating room with API URL:', API_BASE_URL);
  
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name, createdBy }),
  });

  console.log('Create room response status:', response.status);
  console.log('Create room response headers:', response.headers);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Create room error:', errorText);
    throw new Error(`Failed to create room: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const getRooms = async (): Promise<GetRoomsResponse> => {
  console.log('Fetching rooms with API URL:', API_BASE_URL);
  
  const response = await fetch(`${API_BASE_URL}/rooms`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  console.log('Get rooms response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Get rooms error:', errorText);
    throw new Error(`Failed to fetch rooms: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const getRoom = async (roomId: string): Promise<GetRoomResponse> => {
  console.log('Fetching room with API URL:', `${API_BASE_URL}/rooms/${roomId}`);
  
  const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    credentials: 'include',
  });

  console.log('Get room response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Get room error:', errorText);
    throw new Error(`Failed to fetch room: ${response.status} ${response.statusText}`);
  }

  return response.json();
}; 