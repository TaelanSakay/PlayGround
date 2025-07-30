"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Room_1 = require("../models/Room");
const router = express_1.default.Router();
// Create a new room
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, createdBy } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Room name is required' });
        }
        const room = new Room_1.Room({
            name,
            createdBy: createdBy || 'Anonymous',
            createdAt: new Date()
        });
        yield room.save();
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
    }
    catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
}));
// Get room by ID
router.get('/:roomId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { roomId } = req.params;
        const room = yield Room_1.Room.findOne({ roomId });
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
    }
    catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).json({ error: 'Failed to fetch room' });
    }
}));
// Get all rooms
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rooms = yield Room_1.Room.find({}, { elements: 0 }).sort({ createdAt: -1 });
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
    }
    catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
}));
exports.default = router;
