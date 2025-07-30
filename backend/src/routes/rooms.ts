import express from 'express';
import { Room } from '../models/Room';

const router = express.Router();

// Create a new room
router.post('/', async (req, res) => {
  try {
    const { name, createdBy } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const room = new Room({
      name,
      createdBy: createdBy || 'Anonymous',
      createdAt: new Date()
    });

    await room.save();
    
    res.status(201).json({
      success: true,
      room: {
        id: room._id,
        name: room.name,
        roomId: room.roomId,
        createdBy: room.createdBy,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room by ID
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await Room.findOne({ roomId });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({
      success: true,
      room: {
        id: room._id,
        name: room.name,
        roomId: room.roomId,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        elements: room.elements
      }
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({}, { elements: 0 }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      rooms: rooms.map(room => ({
        id: room._id,
        name: room.name,
        roomId: room.roomId,
        createdBy: room.createdBy,
        createdAt: room.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

export default router; 