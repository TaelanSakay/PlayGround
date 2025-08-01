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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = void 0;
const Room_1 = require("../models/Room");
const users = new Map();

// Enhanced validation and sanitization function for whiteboard elements
const validateAndSanitizeElement = (element, userId, isCompletion = false) => {
    try {
        // Check if all required fields are present
        if (!element.id || !element.type || typeof element.x !== 'number' || typeof element.y !== 'number') {
            console.error('Missing required fields in element:', element);
            return null;
        }

        // Validate type
        if (!['drawing', 'text', 'shape'].includes(element.type)) {
            console.error('Invalid element type:', element.type);
            return null;
        }

        // Sanitize and create valid element
        const sanitizedElement = {
            id: String(element.id),
            type: element.type,
            x: Number(element.x),
            y: Number(element.y),
            color: element.color || '#000000',
            strokeWidth: Number(element.strokeWidth) || 2,
            timestamp: Number(element.timestamp) || Date.now(),
            userId: String(element.userId || userId),
            isComplete: Boolean(element.isComplete || isCompletion),
        };

        // Add optional fields if present
        if (element.width !== undefined) sanitizedElement.width = Number(element.width);
        if (element.height !== undefined) sanitizedElement.height = Number(element.height);
        if (element.text !== undefined) sanitizedElement.text = String(element.text);
        if (element.fontSize !== undefined) sanitizedElement.fontSize = Number(element.fontSize);
        if (element.fontFamily !== undefined) sanitizedElement.fontFamily = String(element.fontFamily);
        
        // Handle shapeType - CRITICAL for shape elements
        if (element.shapeType !== undefined) sanitizedElement.shapeType = String(element.shapeType);

        // Type-specific validation and property handling
        if (element.type === 'drawing') {
            // Handle points array for drawing elements with validation
            if (element.points && Array.isArray(element.points)) {
                const validPoints = element.points
                    .filter((point) => typeof point.x === 'number' && typeof point.y === 'number')
                    .map((point) => ({
                        x: Number(point.x),
                        y: Number(point.y)
                    }));

                // Only set points if we have valid points
                if (validPoints.length > 0) {
                    sanitizedElement.points = validPoints;
                } else {
                    console.error('Drawing element has no valid points:', element);
                    return null;
                }
            } else {
                // Drawing elements must have points
                console.error('Drawing element missing points array:', element);
                return null;
            }

            // Completion validation for drawing
            if (isCompletion && sanitizedElement.points.length < 2) {
                console.error('Drawing element must have at least 2 points for completion:', element);
                return null;
            }
            // Creation validation for drawing
            if (!isCompletion && sanitizedElement.points.length < 1) {
                console.error('Drawing element must have at least 1 point for creation:', element);
                return null;
            }
        } 
        else if (element.type === 'shape') {
            // Shape elements MUST have a shapeType
            if (!sanitizedElement.shapeType || !['rectangle', 'circle', 'line'].includes(sanitizedElement.shapeType)) {
                console.error('Shape element has invalid or missing shapeType:', element);
                return null;
            }

            // Shape elements need width and height for completion (except lines)
            if (isCompletion) {
                if (sanitizedElement.shapeType === 'line') {
                    // Lines need points instead of width/height
                    if (element.points && Array.isArray(element.points)) {
                        const validPoints = element.points
                            .filter((point) => typeof point.x === 'number' && typeof point.y === 'number')
                            .map((point) => ({
                                x: Number(point.x),
                                y: Number(point.y)
                            }));
                        
                        if (validPoints.length >= 2) {
                            sanitizedElement.points = validPoints;
                        } else {
                            console.error('Line element must have at least 2 points for completion:', element);
                            return null;
                        }
                    } else {
                        console.error('Line element missing points array:', element);
                        return null;
                    }
                } else {
                    // Rectangle and circle need dimensions
                    if (typeof sanitizedElement.width !== 'number' || typeof sanitizedElement.height !== 'number' || 
                        sanitizedElement.width <= 0 || sanitizedElement.height <= 0) {
                        console.error('Shape element has invalid dimensions for completion:', element);
                        return null;
                    }
                }
            }
            // For creation, we might have width/height of 0 initially
        }
        else if (element.type === 'text') {
            // Text elements need text content when completed
            if (isCompletion) {
                if (!sanitizedElement.text || sanitizedElement.text.trim() === '') {
                    console.error('Text element has empty text for completion:', element);
                    return null;
                }
            }
            // For creation, text might be empty initially
        }

        return sanitizedElement;
    } catch (error) {
        console.error('Error validating element:', error);
        return null;
    }
};

// Function to clean up invalid elements from a room with retry logic
const cleanupInvalidElements = (room) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const validElements = [];
        let hasInvalidElements = false;
        for (const element of room.elements) {
            const validatedElement = validateAndSanitizeElement(element, 'system');
            if (validatedElement) {
                validElements.push(validatedElement);
            }
            else {
                console.error('Removing invalid element from room:', element);
                hasInvalidElements = true;
            }
        }
        if (hasInvalidElements) {
            // Use findOneAndUpdate to avoid version conflicts
            const result = yield Room_1.Room.findOneAndUpdate({ _id: room._id }, { $set: { elements: validElements } }, { new: true, runValidators: true });
            if (result) {
                console.log('Cleaned up invalid elements from room');
                return true;
            }
            else {
                console.error('Failed to update room with cleaned elements');
                return false;
            }
        }
        return true;
    }
    catch (error) {
        console.error('Error cleaning up invalid elements:', error);
        return false;
    }
});

// Retry function for MongoDB operations
const retryOperation = (operation_1, ...args_1) => __awaiter(void 0, [operation_1, ...args_1], void 0, function* (operation, maxRetries = 3, delay = 100) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return yield operation();
        }
        catch (error) {
            if (error.name === 'VersionError' && attempt < maxRetries) {
                console.log(`Version conflict, retrying operation (attempt ${attempt}/${maxRetries})`);
                yield new Promise(resolve => setTimeout(resolve, delay * attempt));
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Operation failed after ${maxRetries} attempts`);
});

const setupSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
        
        // Join room
        socket.on('join-room', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, userName } = data;
                // Find or create room
                let room = yield Room_1.Room.findOne({ roomId });
                if (!room) {
                    return socket.emit('error', { message: 'Room not found' });
                }
                // Clean up any invalid elements in the room
                yield cleanupInvalidElements(room);
                // Add user to room
                const user = {
                    id: socket.id,
                    name: userName,
                    roomId
                };
                users.set(socket.id, user);
                socket.join(roomId);
                // Add to active users if not already there
                if (!room.activeUsers.includes(socket.id)) {
                    yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                        return yield Room_1.Room.findOneAndUpdate({ roomId }, { $addToSet: { activeUsers: socket.id } }, { new: true });
                    }));
                }
                // Get fresh room data after potential updates
                room = yield Room_1.Room.findOne({ roomId });
                if (!room) {
                    return socket.emit('error', { message: 'Room not found' });
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
            }
            catch (error) {
                console.error('Error joining room:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        }));

        // Handle drawing events with retry logic
        socket.on('draw-element', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, element } = data;
                console.log('Received draw-element:', { roomId, elementId: element === null || element === void 0 ? void 0 : element.id, elementType: element === null || element === void 0 ? void 0 : element.type, shapeType: element === null || element === void 0 ? void 0 : element.shapeType });
                // Validate and sanitize element for creation (not completion)
                const sanitizedElement = validateAndSanitizeElement(element, socket.id, false);
                if (!sanitizedElement) {
                    console.error('Element validation failed:', element);
                    return socket.emit('error', { message: 'Invalid element data' });
                }
                console.log('Adding validated element to room:', sanitizedElement.id, 'shapeType:', sanitizedElement.shapeType);
                // Use retry logic for adding element
                yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                    const result = yield Room_1.Room.findOneAndUpdate({ roomId }, { $push: { elements: sanitizedElement } }, { new: true, runValidators: true });
                    if (!result) {
                        throw new Error('Failed to add element to room');
                    }
                    return result;
                }));
                console.log('Element saved successfully:', sanitizedElement.id);
                // Broadcast to other users in the room
                socket.to(roomId).emit('element-drawn', { element: sanitizedElement });
            }
            catch (error) {
                console.error('Error handling draw element:', error);
                socket.emit('error', { message: 'Failed to save element' });
            }
        }));

        // Handle element updates with retry logic
        socket.on('update-element', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, elementId, updates } = data;
                console.log('Received update-element:', { roomId, elementId, shapeType: updates === null || updates === void 0 ? void 0 : updates.shapeType });
                
                // If updates is a complete element, validate it
                if ('type' in updates && 'x' in updates && 'y' in updates) {
                    const sanitizedElement = validateAndSanitizeElement(updates, socket.id, true);
                    if (!sanitizedElement) {
                        console.error('Update rejected: invalid complete element data');
                        return socket.emit('error', { message: 'Invalid element data' });
                    }
                    yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                        const result = yield Room_1.Room.findOneAndUpdate({ roomId, 'elements.id': elementId }, { $set: { 'elements.$': sanitizedElement } }, { new: true, runValidators: true });
                        if (!result) {
                            throw new Error('Failed to update element');
                        }
                        return result;
                    }));
                    // Broadcast the complete element
                    socket.to(roomId).emit('element-updated', { elementId, updates: sanitizedElement });
                }
                else {
                    // Handle partial updates (for backward compatibility)
                    const partialUpdates = { ...updates };
                    
                    // Validate updates if they contain points
                    if (updates.points && Array.isArray(updates.points)) {
                        const validPoints = updates.points
                            .filter((point) => typeof point.x === 'number' && typeof point.y === 'number')
                            .map((point) => ({
                            x: Number(point.x),
                            y: Number(point.y)
                        }));
                        if (validPoints.length < 2) {
                            console.error('Update rejected: insufficient points for drawing element');
                            return socket.emit('error', { message: 'Invalid points data' });
                        }
                        partialUpdates.points = validPoints;
                    }
                    
                    // Preserve shapeType if provided
                    if (updates.shapeType) {
                        partialUpdates.shapeType = String(updates.shapeType);
                    }
                    
                    // Build update object with proper dot notation for nested updates
                    const updateFields = {};
                    Object.keys(partialUpdates).forEach(key => {
                        updateFields[`elements.$.${key}`] = partialUpdates[key];
                    });
                    
                    yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                        const result = yield Room_1.Room.findOneAndUpdate({ roomId, 'elements.id': elementId }, { $set: updateFields }, { new: true, runValidators: true });
                        if (!result) {
                            throw new Error('Failed to update element');
                        }
                        return result;
                    }));
                    // Broadcast partial updates
                    socket.to(roomId).emit('element-updated', { elementId, updates: partialUpdates });
                }
            }
            catch (error) {
                console.error('Error updating element:', error);
                socket.emit('error', { message: 'Failed to update element' });
            }
        }));

        // Handle element deletion with retry logic
        socket.on('delete-element', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, elementId } = data;
                yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                    const result = yield Room_1.Room.findOneAndUpdate({ roomId }, { $pull: { elements: { id: elementId } } }, { new: true });
                    if (!result) {
                        throw new Error('Failed to delete element');
                    }
                    return result;
                }));
                // Broadcast to other users
                socket.to(roomId).emit('element-deleted', { elementId });
            }
            catch (error) {
                console.error('Error deleting element:', error);
                socket.emit('error', { message: 'Failed to delete element' });
            }
        }));

        // Handle clear canvas - NEW HANDLER
        socket.on('clear-canvas', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId } = data;
                console.log('Received clear-canvas for room:', roomId);
                
                // Clear all elements from the room in MongoDB
                yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                    const result = yield Room_1.Room.findOneAndUpdate({ roomId }, { $set: { elements: [] } }, { new: true, runValidators: true });
                    if (!result) {
                        throw new Error('Failed to clear canvas');
                    }
                    return result;
                }));
                
                console.log('Canvas cleared successfully for room:', roomId);
                
                // Broadcast to all users in the room (including sender)
                io.to(roomId).emit('canvas-cleared', { roomId });
            }
            catch (error) {
                console.error('Error clearing canvas:', error);
                socket.emit('error', { message: 'Failed to clear canvas' });
            }
        }));

        // Handle undo action with retry logic
        socket.on('undo-action', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, elements } = data;
                // Validate all elements in the array
                const validatedElements = [];
                for (const element of elements) {
                    const validatedElement = validateAndSanitizeElement(element, socket.id);
                    if (validatedElement) {
                        validatedElements.push(validatedElement);
                    }
                    else {
                        console.error('Skipping invalid element in undo action:', element);
                    }
                }
                // Update room with validated elements state
                yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                    const result = yield Room_1.Room.findOneAndUpdate({ roomId }, { $set: { elements: validatedElements } }, { new: true, runValidators: true });
                    if (!result) {
                        throw new Error('Failed to update room state');
                    }
                    return result;
                }));
                // Broadcast to other users in the room
                socket.to(roomId).emit('undo-action', { elements: validatedElements });
            }
            catch (error) {
                console.error('Error handling undo action:', error);
                socket.emit('error', { message: 'Failed to process undo action' });
            }
        }));

        // Handle redo action with retry logic
        socket.on('redo-action', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, elements } = data;
                // Validate all elements in the array
                const validatedElements = [];
                for (const element of elements) {
                    const validatedElement = validateAndSanitizeElement(element, socket.id);
                    if (validatedElement) {
                        validatedElements.push(validatedElement);
                    }
                    else {
                        console.error('Skipping invalid element in redo action:', element);
                    }
                }
                // Update room with validated elements state
                yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                    const result = yield Room_1.Room.findOneAndUpdate({ roomId }, { $set: { elements: validatedElements } }, { new: true, runValidators: true });
                    if (!result) {
                        throw new Error('Failed to update room state');
                    }
                    return result;
                }));
                // Broadcast to other users in the room
                socket.to(roomId).emit('redo-action', { elements: validatedElements });
            }
            catch (error) {
                console.error('Error handling redo action:', error);
                socket.emit('error', { message: 'Failed to process redo action' });
            }
        }));

        // Handle cursor movement
        socket.on('cursor-move', (data) => {
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

        // Handle text input with retry logic
        socket.on('text-input', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, element } = data;
                // Validate and sanitize element
                const sanitizedElement = validateAndSanitizeElement(element, socket.id);
                if (!sanitizedElement) {
                    return socket.emit('error', { message: 'Invalid text element data' });
                }
                // Add or update text element
                yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                    const existingIndex = yield Room_1.Room.findOne({ roomId, 'elements.id': sanitizedElement.id });
                    if (existingIndex) {
                        // Update existing element
                        return yield Room_1.Room.findOneAndUpdate({ roomId, 'elements.id': sanitizedElement.id }, { $set: { 'elements.$': sanitizedElement } }, { new: true, runValidators: true });
                    }
                    else {
                        // Add new element
                        return yield Room_1.Room.findOneAndUpdate({ roomId }, { $push: { elements: sanitizedElement } }, { new: true, runValidators: true });
                    }
                }));
                // Broadcast to other users
                socket.to(roomId).emit('text-input', { element: sanitizedElement });
            }
            catch (error) {
                console.error('Error handling text input:', error);
                socket.emit('error', { message: 'Failed to save text' });
            }
        }));

        // Handle element completion with strict validation
        socket.on('complete-element', (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { roomId, elementId, element } = data;
                console.log('Received complete-element:', { roomId, elementId, elementType: element === null || element === void 0 ? void 0 : element.type, shapeType: element === null || element === void 0 ? void 0 : element.shapeType });
                // Validate and sanitize element for completion (strict validation)
                const sanitizedElement = validateAndSanitizeElement(element, socket.id, true);
                if (!sanitizedElement) {
                    console.error('Element completion validation failed:', element);
                    return socket.emit('error', { message: 'Invalid element data for completion' });
                }
                console.log('Completing element in room:', sanitizedElement.id, 'shapeType:', sanitizedElement.shapeType);
                // Use retry logic for completing element
                yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                    const result = yield Room_1.Room.findOneAndUpdate({ roomId, 'elements.id': elementId }, { $set: { 'elements.$': sanitizedElement } }, { new: true, runValidators: true });
                    if (!result) {
                        throw new Error('Failed to complete element in room');
                    }
                    return result;
                }));
                console.log('Element completed successfully:', sanitizedElement.id);
                // Broadcast to other users in the room
                socket.to(roomId).emit('element-completed', { element: sanitizedElement });
            }
            catch (error) {
                console.error('Error handling complete element:', error);
                socket.emit('error', { message: 'Failed to complete element' });
            }
        }));

        // Handle disconnect
        socket.on('disconnect', () => __awaiter(void 0, void 0, void 0, function* () {
            const user = users.get(socket.id);
            if (user) {
                try {
                    yield retryOperation(() => __awaiter(void 0, void 0, void 0, function* () {
                        return yield Room_1.Room.findOneAndUpdate({ roomId: user.roomId }, { $pull: { activeUsers: socket.id } }, { new: true });
                    }));
                    // Notify other users
                    socket.to(user.roomId).emit('user-left', {
                        userId: socket.id,
                        userName: user.name
                    });
                    users.delete(socket.id);
                    console.log(`User ${user.name} disconnected from room ${user.roomId}`);
                }
                catch (error) {
                    console.error('Error handling disconnect:', error);
                }
            }
        }));
    });
};

exports.setupSocketHandlers = setupSocketHandlers;