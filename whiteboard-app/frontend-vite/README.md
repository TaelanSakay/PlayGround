# Whiteboard App Frontend (Vite)

This is the frontend for the Real-Time Multi-User Whiteboard Application, migrated from Create React App to Vite for improved performance and security.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## 🛠 Tech Stack

- **Vite** - Fast build tool and dev server
- **React 19** - UI library with TypeScript
- **Socket.IO Client** - Real-time communication
- **TailwindCSS** - Utility-first CSS framework
- **TypeScript** - Type safety

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── Canvas.tsx      # Drawing canvas component
│   ├── RoomList.tsx    # Room selection component
│   ├── Toolbar.tsx     # Drawing tools toolbar
│   ├── UserList.tsx    # Active users list
│   └── Whiteboard.tsx  # Main whiteboard component
├── hooks/              # Custom React hooks
│   └── useSocket.ts    # Socket.IO connection hook
├── services/           # API services
│   └── api.ts          # Room management API
├── types/              # TypeScript type definitions
│   └── whiteboard.ts   # Whiteboard element types
├── utils/              # Utility functions
├── App.tsx             # Main app component
├── App.css             # App-specific styles
├── index.css           # Global styles with TailwindCSS
├── main.tsx            # Vite entry point
└── logo.svg            # App logo
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### TailwindCSS
The project uses TailwindCSS for styling. Configuration is in `tailwind.config.js`.

### TypeScript
TypeScript configuration is optimized for Vite in `tsconfig.app.json`.

## 🎯 Features

- **Real-time Collaboration**: Multiple users can draw simultaneously
- **Drawing Tools**: Pen, eraser, text, shapes (rectangle, circle, line)
- **Undo/Redo**: Full history management with keyboard shortcuts
- **Color & Stroke Control**: Customizable colors and stroke widths
- **Live User Cursors**: See other users' cursor positions
- **Room Management**: Create and join whiteboard sessions
- **Modern UI**: Clean, responsive interface with TailwindCSS

## 🔄 Migration from CRA

This project was successfully migrated from Create React App to Vite. See `MIGRATION_GUIDE.md` for detailed information about the migration process.

## 🚀 Deployment

### Vercel
1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables: `VITE_API_URL`, `VITE_SOCKET_URL`

### Netlify
1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
