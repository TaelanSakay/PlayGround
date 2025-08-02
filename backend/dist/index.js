"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
// Load environment variables
dotenv_1.default.config();
console.log('=== STARTING SERVER ===');
console.log('Environment variables check:');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('PORT:', process.env.PORT);
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
console.log('Express app created');
console.log('HTTP server created');
// CORS configuration
const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:5173"
];
// Validate FRONTEND_URL to ensure it's not causing routing issues
if (process.env.FRONTEND_URL) {
    try {
        const url = new URL(process.env.FRONTEND_URL);
        console.log('FRONTEND_URL is valid:', url.toString());
    }
    catch (error) {
        console.error('Invalid FRONTEND_URL:', process.env.FRONTEND_URL);
        console.error('This might cause CORS issues');
    }
}
else {
    console.log('FRONTEND_URL is not set, using default localhost');
}
console.log('Allowed CORS origins:', allowedOrigins);
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
};
console.log('CORS options created successfully');
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});
console.log('Socket.IO configured');
// Middleware
console.log('Setting up middleware...');
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// Handle preflight requests - using specific paths instead of wildcard
console.log('Setting up preflight request handling');
app.options('/api/rooms', (0, cors_1.default)(corsOptions));
app.options('/api/cors-test', (0, cors_1.default)(corsOptions));
// Simple test route first
console.log('Setting up test route');
app.get('/test', (req, res) => {
    res.json({ message: 'Test route working' });
});
// Health check endpoint
console.log('Setting up health endpoint');
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Whiteboard server is running' });
});
// CORS test endpoint
console.log('Setting up CORS test endpoints');
app.get('/api/cors-test', (req, res) => {
    res.json({
        status: 'OK',
        message: 'CORS is working',
        origin: req.headers.origin,
        allowedOrigins: allowedOrigins
    });
});
app.post('/api/cors-test', (req, res) => {
    res.json({
        status: 'OK',
        message: 'POST CORS is working',
        origin: req.headers.origin,
        body: req.body
    });
});
// Now try to import and mount the routes
console.log('=== TRYING TO IMPORT ROUTES ===');
try {
    console.log('Importing roomRoutes from ./routes/rooms');
    const roomRoutes = require('./routes/rooms').default;
    console.log('roomRoutes imported successfully:', !!roomRoutes);
    console.log('roomRoutes type:', typeof roomRoutes);
    // Routes
    console.log('Setting up routes...');
    console.log('Mounting /api/rooms route');
    // Ensure the path is a string and not a URL
    const roomsPath = '/api/rooms';
    console.log('Mounting route with path:', roomsPath);
    console.log('Path type:', typeof roomsPath);
    // Validate roomRoutes before mounting
    if (!roomRoutes) {
        console.error('ERROR: roomRoutes is undefined!');
        throw new Error('roomRoutes is undefined');
    }
    if (typeof roomRoutes !== 'function') {
        console.error('ERROR: roomRoutes is not a function!');
        console.error('roomRoutes type:', typeof roomRoutes);
        throw new Error('roomRoutes is not a valid Express router');
    }
    console.log('roomRoutes is valid, mounting...');
    app.use(roomsPath, roomRoutes);
    console.log('Routes mounted successfully');
}
catch (error) {
    console.error('ERROR importing routes:', error);
    // Continue without routes for now
}
// Setup Socket.IO handlers
console.log('Setting up Socket.IO handlers...');
try {
    const { setupSocketHandlers } = require('./socket/handlers');
    console.log('setupSocketHandlers type:', typeof setupSocketHandlers);
    setupSocketHandlers(io);
    console.log('Socket.IO handlers setup successfully');
}
catch (error) {
    console.error('ERROR setting up Socket.IO handlers:', error);
    // Continue without socket handlers for now
}
// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whiteboard';
console.log('Connecting to MongoDB...');
mongoose_1.default.connect(MONGODB_URI)
    .then(() => {
    console.log('Connected to MongoDB');
})
    .catch((error) => {
    console.error('MongoDB connection error:', error);
});
// Start server
const PORT = process.env.PORT || 5000;
console.log('Starting server on port:', PORT);
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Allowed CORS origins:', allowedOrigins);
});
