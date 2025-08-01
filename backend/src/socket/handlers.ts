import { Server, Socket } from 'socket.io';
import { Room, IWhiteboardElement } from '../models/Room';

interface User {
  id: string;
  name: string;
  roomId: string;
  cursor?: { x: number; y: number };
}

const users = new Map<string, User>();

// Enhanced validation function
const validateElement = (element: any): IWhiteboardElement | null => {
  try {
    if (!element.id || !element.type || typeof element.x !== 'number' || typeof element.y !== 'number') {
      return null;
    }

    const sanitized: IWhiteboardElement = {
      id: String(element.id),
      type: element.type as 'drawing' | 'text' | 'shape' | 'image',
      x: Number(element.x),
      y: Number(element.y),
      color: element.color || '#000000',
      fillColor: element.fillColor, // New: fill color support
      strokeWidth: Number(element.strokeWidth) || 2,
      timestamp: Number(element.timestamp) || Date.now(),
      userId: String(element.userId || 'unknown'),
      isComplete: Boolean(element.isComplete),
    };

    // Add optional fields with better validation
    if (element.width !== undefined && !isNaN(element.width)) sanitized.width = Number(element.width);
    if (element.height !== undefined && !isNaN(element.height)) sanitized.height = Number(element.height);
    if (element.text !== undefined) sanitized.text = String(element.text);
    if (element.fontSize !== undefined && !isNaN(element.fontSize)) sanitized.fontSize = Number(element.fontSize);
    if (element.fontFamily !== undefined) sanitized.fontFamily = String(element.fontFamily);
    if (element.fillColor !== undefined) sanitized.fillColor = String(element.fillColor);
    if (element.imageData !== undefined) sanitized.imageData = String(element.imageData);
    
    // Handle shapeType with validation
    if (element.shapeType !== undefined) {
      const validShapeTypes = ['rectangle', 'circle', 'line'];
      if (validShapeTypes.includes(element.shapeType)) {
        sanitized.shapeType = element.shapeType as 'rectangle' | 'circle' | 'line';
      } else {
        console.warn('Invalid shapeType:', element.shapeType);
      }
    }

    // Handle points array with better validation
    if (element.points && Array.isArray(element.points)) {
      const validPoints = element.points
        .filter((point: any) => 
          point && 
          typeof point === 'object' && 
          typeof point.x === 'number' && 
          typeof point.y === 'number' &&
          !isNaN(point.x) && 
          !isNaN(point.y)
        )
        .map((point: any) => ({
          x: Number(point.x),
          y: Number(point.y)
        }));
      
      if (validPoints.length > 0) {
        sanitized.points = validPoints;
      }
    }

    return sanitized;
  } catch (error) {
    console.error('Error validating element:', error);
    return null;
  }
};

// Retry function for MongoDB operations
const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 100
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (error.name === 'VersionError' && attempt < maxRetries) {
        console.log(`Version conflict, retrying operation (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Operation failed after ${maxRetries} attempts`);
};

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room
    socket.on('join-room', async (data: { roomId: string; userName: string }) => {
      try {
        const { roomId, userName } = data;
        
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

        // Add to active users
        await retryOperation(async () => {
          return await Room.findOneAndUpdate(
            { roomId },
            { $addToSet: { activeUsers: socket.id } },
            { new: true }
          );
        });

        // Get fresh room data
        room = await Room.findOne({ roomId });
        if (!room) {
          return socket.emit('error', { message: 'Room not found' });
        }

        // Send room data to the joining user
        socket.emit('room-joined', {
          room: {
            id: room._id,
            name: room.name,
            roomId: room.roomId,
            elements: room.elements || []
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
        console.log('Received draw-element:', { roomId, elementId: element?.id, elementType: element?.type, shapeType: element?.shapeType });
        
        const validatedElement = validateElement(element);
        if (!validatedElement) {
          console.error('Element validation failed:', element);
          return socket.emit('error', { message: 'Invalid element data' });
        }

        console.log('Validated element shapeType:', validatedElement.shapeType);

        // Add element to room
        await retryOperation(async () => {
          const result = await Room.findOneAndUpdate(
            { roomId },
            { $push: { elements: validatedElement } },
            { new: true, runValidators: true }
          );
          
          if (!result) {
            throw new Error('Failed to add element to room');
          }
          
          return result;
        });

        console.log('Element saved successfully:', validatedElement.id);

        // Broadcast to other users
        socket.to(roomId).emit('element-drawn', { element: validatedElement });
      } catch (error) {
        console.error('Error handling draw element:', error);
        socket.emit('error', { message: 'Failed to save element' });
      }
    });

    // Handle element updates
    socket.on('update-element', async (data: { roomId: string; elementId: string; updates: Partial<IWhiteboardElement> | IWhiteboardElement }) => {
      try {
        const { roomId, elementId, updates } = data;
        
        // Validate the updates
        const fullElement = 'type' in updates ? updates : null;
        if (fullElement) {
          const validatedElement = validateElement(fullElement);
          if (!validatedElement) {
            return socket.emit('error', { message: 'Invalid element data' });
          }
          
          // Update with full validated element
          await retryOperation(async () => {
            const result = await Room.findOneAndUpdate(
              { roomId, 'elements.id': elementId },
              { $set: { 'elements.$': validatedElement } },
              { new: true, runValidators: true }
            );
            
            if (!result) {
              throw new Error('Failed to update element');
            }
            
            return result;
          });

          // Broadcast full element to other users
          socket.to(roomId).emit('element-updated', { elementId, updates: validatedElement });
        } else {
          // Partial update - be more careful
          const updateFields: any = {};
          Object.keys(updates).forEach(key => {
            updateFields[`elements.$.${key}`] = (updates as any)[key];
          });

          await retryOperation(async () => {
            const result = await Room.findOneAndUpdate(
              { roomId, 'elements.id': elementId },
              { $set: updateFields },
              { new: true, runValidators: true }
            );
            
            if (!result) {
              throw new Error('Failed to update element');
            }
            
            return result;
          });

          // Broadcast partial updates to other users
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
        console.log('Received delete-element:', { roomId, elementId });
        
        // Remove element from room
        const result = await retryOperation(async () => {
          return await Room.findOneAndUpdate(
            { roomId },
            { $pull: { elements: { id: elementId } } },
            { new: true }
          );
        });
        
        if (!result) {
          throw new Error('Failed to delete element');
        }

        console.log('Element deleted successfully:', elementId);

        // Broadcast deletion to other users
        socket.to(roomId).emit('element-deleted', { elementId });
      } catch (error) {
        console.error('Error deleting element:', error);
        socket.emit('error', { message: 'Failed to delete element' });
      }
    });

    // Handle element completion
    socket.on('complete-element', async (data: { roomId: string; elementId: string; element: IWhiteboardElement }) => {
      try {
        const { roomId, elementId, element } = data;
        console.log('Received complete-element:', { roomId, elementId, elementType: element?.type });
        
        const validatedElement = validateElement(element);
        if (!validatedElement) {
          console.error('Element validation failed:', element);
          return socket.emit('error', { message: 'Invalid element data' });
        }

        // Mark element as complete
        validatedElement.isComplete = true;

        // Update element in room
        await retryOperation(async () => {
          const result = await Room.findOneAndUpdate(
            { roomId, 'elements.id': elementId },
            { $set: { 'elements.$': validatedElement } },
            { new: true, runValidators: true }
          );
          
          if (!result) {
            throw new Error('Failed to complete element');
          }
          
          return result;
        });

        console.log('Element completed successfully:', elementId);

        // Broadcast completion to other users
        socket.to(roomId).emit('element-completed', { element: validatedElement });
      } catch (error) {
        console.error('Error completing element:', error);
        socket.emit('error', { message: 'Failed to complete element' });
      }
    });

    // Handle undo action
    socket.on('undo-action', async (data: { roomId: string; elements: IWhiteboardElement[] }) => {
      try {
        const { roomId, elements } = data;

        // Validate all elements
        const validatedElements: IWhiteboardElement[] = [];
        for (const element of elements) {
          const validatedElement = validateElement(element);
          if (validatedElement) {
            validatedElements.push(validatedElement);
          }
        }

        // Update room with new elements state
        await retryOperation(async () => {
          const result = await Room.findOneAndUpdate(
            { roomId },
            { $set: { elements: validatedElements } },
            { new: true, runValidators: true }
          );
          
          if (!result) {
            throw new Error('Failed to update room state');
          }
          
          return result;
        });

        // Broadcast to other users
        socket.to(roomId).emit('undo-action', { elements: validatedElements });
      } catch (error) {
        console.error('Error handling undo action:', error);
        socket.emit('error', { message: 'Failed to process undo action' });
      }
    });

    // Handle redo action
    socket.on('redo-action', async (data: { roomId: string; elements: IWhiteboardElement[] }) => {
      try {
        const { roomId, elements } = data;

        // Validate all elements
        const validatedElements: IWhiteboardElement[] = [];
        for (const element of elements) {
          const validatedElement = validateElement(element);
          if (validatedElement) {
            validatedElements.push(validatedElement);
          }
        }

        // Update room with new elements state
        await retryOperation(async () => {
          const result = await Room.findOneAndUpdate(
            { roomId },
            { $set: { elements: validatedElements } },
            { new: true, runValidators: true }
          );
          
          if (!result) {
            throw new Error('Failed to update room state');
          }
          
          return result;
        });

        // Broadcast to other users
        socket.to(roomId).emit('redo-action', { elements: validatedElements });
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

    // Handle cursor stopped
    socket.on('cursor-stopped', (data: { roomId: string }) => {
      const { roomId } = data;
      const user = users.get(socket.id);
      
      if (user && user.roomId === roomId) {
        user.cursor = undefined;
        socket.to(roomId).emit('cursor-stopped', {
          userId: socket.id
        });
      }
    });

    // Enhanced text input handler
    socket.on('text-input', async (data: { roomId: string; element: IWhiteboardElement }) => {
      try {
        const { roomId, element } = data;
        console.log('Received text-input:', { roomId, elementId: element?.id, text: element?.text });

        const validatedElement = validateElement(element);
        if (!validatedElement) {
          return socket.emit('error', { message: 'Invalid text element data' });
        }

        // Ensure it's a text element
        if (validatedElement.type !== 'text') {
          return socket.emit('error', { message: 'Element must be of type text' });
        }

        // Check if element already exists
        const existingRoom = await Room.findOne({ roomId, 'elements.id': validatedElement.id });
        
        let result;
        if (existingRoom) {
          // Update existing text element
          result = await retryOperation(async () => {
            return await Room.findOneAndUpdate(
              { roomId, 'elements.id': validatedElement.id },
              { $set: { 'elements.$': validatedElement } },
              { new: true, runValidators: true }
            );
          });
          console.log('Text element updated:', validatedElement.id);
        } else {
          // Add new text element
          result = await retryOperation(async () => {
            return await Room.findOneAndUpdate(
              { roomId },
              { $push: { elements: validatedElement } },
              { new: true, runValidators: true }
            );
          });
          console.log('Text element added:', validatedElement.id);
        }

        if (!result) {
          throw new Error('Failed to save text element');
        }

        // Broadcast to other users
        socket.to(roomId).emit('text-updated', { element: validatedElement });
      } catch (error) {
        console.error('Error handling text input:', error);
        socket.emit('error', { message: 'Failed to save text' });
      }
    });

    // Handle clear canvas
    socket.on('clear-canvas', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        console.log('Received clear-canvas for room:', roomId);
        
        // Clear all elements from room
        const result = await retryOperation(async () => {
          return await Room.findOneAndUpdate(
            { roomId },
            { $set: { elements: [] } },
            { new: true, runValidators: true }
          );
        });
        
        if (!result) {
          throw new Error('Failed to clear canvas in room');
        }

        console.log('Canvas cleared successfully for room:', roomId);

        // Broadcast to ALL clients in the room (including sender)
        io.to(roomId).emit('canvas-cleared', { 
          elements: []
        });
      } catch (error) {
        console.error('Error handling clear canvas:', error);
        socket.emit('error', { message: 'Failed to clear canvas' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const user = users.get(socket.id);
      
      if (user) {
        try {
          await retryOperation(async () => {
            return await Room.findOneAndUpdate(
              { roomId: user.roomId },
              { $pull: { activeUsers: socket.id } },
              { new: true }
            );
          });

          // Notify other users
          socket.to(user.roomId).emit('user-left', {
            userId: socket.id,
            userName: user.name
          });

          users.delete(socket.id);
          console.log(`User ${user.name} disconnected from room ${user.roomId}`);
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });
  });
};