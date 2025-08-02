 # Real-Time Multi-User Whiteboard Application

A collaborative whiteboard application built with React, TypeScript, Node.js, Express, Socket.IO, and MongoDB. Multiple users can draw, write text, and create shapes in real-time on a shared canvas.
<img width="1920" height="921" alt="image" src="https://github.com/user-attachments/assets/814881e3-2d9b-47cd-9081-0063f6a812da" />

## 🚀 Features

- **Real-time Collaboration**: Multiple users can draw simultaneously
- **Drawing Tools**: Pen, eraser, text, shapes (rectangle, circle, line)
- **Undo/Redo**: Full history management with keyboard shortcuts (Ctrl+Z/Ctrl+Y)
- **Color & Stroke Control**: Customizable colors and stroke widths
- **Live User Cursors**: See other users' cursor positions in real-time
- **Room Management**: Create and join whiteboard sessions
- **Persistent Sessions**: Whiteboard state is saved to MongoDB
- **Modern UI**: Clean, responsive interface built with TailwindCSS

## 🛠 Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for fast development and optimized builds
- Socket.IO Client for real-time communication
- TailwindCSS for styling
- Canvas API for drawing functionality

### Backend
- Node.js with Express
- Socket.IO for WebSocket communication
- MongoDB with Mongoose for data persistence
- TypeScript for type safety

## 📁 Project Structure

```
whiteboard-app/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # Utility functions
│   └── package.json
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # Express routes
│   │   ├── socket/         # Socket.IO handlers
│   │   └── utils/          # Utility functions
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whiteboard-app
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**

   Create a `.env` file in the backend directory:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/whiteboard
       FRONTEND_URL=http://localhost:5173
   NODE_ENV=development
   ```

5. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

6. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

7. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```

8. **Open your browser**
   Navigate to `http://localhost:5173`

## 🎯 Usage

### Creating a Room
1. Enter a room name and your username
2. Click "Create Room"
3. Share the room ID with others to collaborate

### Joining a Room
1. Select an existing room from the list
2. Enter your username
3. Click "Join Room"

### Drawing Tools
- **Pen**: Freehand drawing
- **Eraser**: Remove drawn elements
- **Text**: Add text to the canvas
- **Rectangle**: Draw rectangles
- **Circle**: Draw circles
- **Line**: Draw straight lines

### Undo/Redo Functionality
- **Undo**: Click the undo button (↶) or press `Ctrl+Z` (or `Cmd+Z` on Mac)
- **Redo**: Click the redo button (↷) or press `Ctrl+Y` (or `Cmd+Shift+Z` on Mac)
- **History Management**: All actions are tracked and can be undone/redone
- **Collaborative**: Undo/redo actions are synchronized across all users in the room

### Real-time Features
- See other users' cursors in real-time
- All drawing actions are synchronized across all connected users
- User list shows all active participants

## 🔧 Development

### Backend Scripts
```bash
npm run dev      # Start development server with nodemon
npm run build    # Build TypeScript to JavaScript
npm start        # Start production server
```

### Frontend Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variable: `VITE_API_URL`

### Backend (Render/Heroku)
1. Set up MongoDB Atlas or other cloud database
2. Deploy to Render or Heroku
3. Set environment variables:
   - `MONGODB_URI`
   - `FRONTEND_URL`
   - `PORT`

## 📝 API Endpoints

### Rooms
- `POST /api/rooms` - Create a new room
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:roomId` - Get specific room

### Socket.IO Events
- `join-room` - Join a whiteboard room
- `draw-element` - Draw a new element
- `update-element` - Update an existing element
- `delete-element` - Delete an element
- `cursor-move` - Update cursor position
- `text-input` - Add or update text
- `undo-action` - Undo the last action (synchronized across all users)
- `redo-action` - Redo the last undone action (synchronized across all users)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎯 Resume Highlights

This project demonstrates:
- ✅ Real-time collaborative system with WebSocket-based bidirectional communication
- ✅ CRDT-based state synchronization for conflict-free merges
- ✅ Modular frontend components for drawing, shape tools, and live user cursors
- ✅ Persistent sessions in database and shareable room links
- ✅ Fully deployed full-stack application with scalable backend 
