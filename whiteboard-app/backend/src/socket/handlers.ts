import { Server, Socket } from 'socket.io';
import { Room, IWhiteboardElement } from '../models/Room';

interface User {
  id: string;
  name: string;
  roomId: string;
  cursor?: { x: number; y: number };
}

const users = new Map<string, User>();

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room
    socket.on('join-room', async (data: { roomId: string; userName: string }) => {
      try {
        const { roomId, userName } = data;
        
        // Find or create room
        let room = await Room.findOne({ roomId });
        
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Add user to room
        const user: User = {
          id: socket.id,
          name: userName,
          roomId
        };
        
        users.set(socket.id, user);
        socket.join(roomId);

        // Add to active users if not already there
        if (!room.activeUsers.includes(socket.id)) {
          room.activeUsers.push(socket.id);
          await room.save();
        }

        // Send room data to the joining user
        socket.emit('room-joined', {
          room: {
            id: room._id,
            name: room.name,
            roomId: room.roomId,
            elements: room.elements
          },
          users: Array.from(users.values()).filter(u => u.roomId === roomId)
        });

        // Notify other users in the room
        socket.to(roomId).emit('user-joined', {
          user: { id: socket.id, name: userName }
        });

        console.log(`${userName} joined room ${roomId}`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle drawing events
    socket.on('draw-element', async (data: { roomId: string; element: IWhiteboardElement }) => {
      try {
        const { roomId, element } = data;
        const room = await Room.findOne({ roomId });
        
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Add element to room
        room.elements.push(element);
        await room.save();

        // Broadcast to other users in the room
        socket.to(roomId).emit('element-drawn', { element });
      } catch (error) {
        console.error('Error handling draw element:', error);
        socket.emit('error', { message: 'Failed to save element' });
      }
    });

    // Handle element updates
    socket.on('update-element', async (data: { roomId: string; elementId: string; updates: Partial<IWhiteboardElement> }) => {
      try {
        const { roomId, elementId, updates } = data;
        const room = await Room.findOne({ roomId });
        
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Find and update element
        const elementIndex = room.elements.findIndex(el => el.id === elementId);
        if (elementIndex !== -1) {
          room.elements[elementIndex] = { ...room.elements[elementIndex], ...updates };
          await room.save();

          // Broadcast to other users
          socket.to(roomId).emit('element-updated', { elementId, updates });
        }
      } catch (error) {
        console.error('Error updating element:', error);
        socket.emit('error', { message: 'Failed to update element' });
      }
    });

    // Handle element deletion
    socket.on('delete-element', async (data: { roomId: string; elementId: string }) => {
      try {
        const { roomId, elementId } = data;
        const room = await Room.findOne({ roomId });
        
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Remove element
        room.elements = room.elements.filter(el => el.id !== elementId);
        await room.save();

        // Broadcast to other users
        socket.to(roomId).emit('element-deleted', { elementId });
      } catch (error) {
        console.error('Error deleting element:', error);
        socket.emit('error', { message: 'Failed to delete element' });
      }
    });

    // Handle undo action
    socket.on('undo-action', async (data: { roomId: string; elements: IWhiteboardElement[] }) => {
      try {
        const { roomId, elements } = data;
        const room = await Room.findOne({ roomId });
        
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Update room with new elements state
        room.elements = elements;
        await room.save();

        // Broadcast to other users in the room
        socket.to(roomId).emit('undo-action', { elements });
      } catch (error) {
        console.error('Error handling undo action:', error);
        socket.emit('error', { message: 'Failed to process undo action' });
      }
    });

    // Handle redo action
    socket.on('redo-action', async (data: { roomId: string; elements: IWhiteboardElement[] }) => {
      try {
        const { roomId, elements } = data;
        const room = await Room.findOne({ roomId });
        
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Update room with new elements state
        room.elements = elements;
        await room.save();

        // Broadcast to other users in the room
        socket.to(roomId).emit('redo-action', { elements });
      } catch (error) {
        console.error('Error handling redo action:', error);
        socket.emit('error', { message: 'Failed to process redo action' });
      }
    });

    // Handle cursor movement
    socket.on('cursor-move', (data: { roomId: string; cursor: { x: number; y: number } }) => {
      const { roomId, cursor } = data;
      const user = users.get(socket.id);
      
      if (user && user.roomId === roomId) {
        user.cursor = cursor;
        socket.to(roomId).emit('cursor-moved', {
          userId: socket.id,
          userName: user.name,
          cursor
        });
      }
    });

    // Handle text input
    socket.on('text-input', async (data: { roomId: string; element: IWhiteboardElement }) => {
      try {
        const { roomId, element } = data;
        const room = await Room.findOne({ roomId });
        
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Add or update text element
        const existingIndex = room.elements.findIndex(el => el.id === element.id);
        if (existingIndex !== -1) {
          room.elements[existingIndex] = element;
        } else {
          room.elements.push(element);
        }
        
        await room.save();

        // Broadcast to other users
        socket.to(roomId).emit('text-input', { element });
      } catch (error) {
        console.error('Error handling text input:', error);
        socket.emit('error', { message: 'Failed to save text' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const user = users.get(socket.id);
      
      if (user) {
        const room = await Room.findOne({ roomId: user.roomId });
        if (room) {
          // Remove from active users
          room.activeUsers = room.activeUsers.filter(id => id !== socket.id);
          await room.save();
        }

        // Notify other users
        socket.to(user.roomId).emit('user-left', {
          userId: socket.id,
          userName: user.name
        });

        users.delete(socket.id);
        console.log(`User ${user.name} disconnected from room ${user.roomId}`);
      }
    });
  });
}; 