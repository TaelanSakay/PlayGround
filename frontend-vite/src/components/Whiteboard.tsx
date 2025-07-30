import React, { useEffect, useState, useCallback } from 'react';
import { Room, WhiteboardElement, User } from '../types/whiteboard';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import UserList from './UserList';
import { useSocket } from '../hooks/useSocket';

interface WhiteboardProps {
  room: Room;
  userName: string;
  onLeaveRoom: () => void;
}

interface HistoryState {
  elements: WhiteboardElement[];
  timestamp: number;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ room, userName, onLeaveRoom }) => {
  const [elements, setElements] = useState<WhiteboardElement[]>(room.elements || []);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTool, setSelectedTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  
  // History management for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);
  
  const socket = useSocket();

  // Add current state to history
  const addToHistory = useCallback((newElements: WhiteboardElement[]) => {
    if (isUndoRedoAction) {
      setIsUndoRedoAction(false);
      return;
    }

    const newHistoryState: HistoryState = {
      elements: [...newElements],
      timestamp: Date.now()
    };

    setHistory(prev => {
      // Remove any future history if we're not at the end
      const updatedHistory = prev.slice(0, historyIndex + 1);
      return [...updatedHistory, newHistoryState];
    });
    setHistoryIndex(prev => prev + 1);
  }, [isUndoRedoAction, historyIndex]);

  // Undo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      setElements(previousState.elements);
      setHistoryIndex(newIndex);
      setIsUndoRedoAction(true);
      
      // Emit undo action to other users
      socket?.emit('undo-action', { roomId: room.roomId, elements: previousState.elements });
    }
  }, [historyIndex, history, socket, room.roomId]);

  // Redo functionality
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setElements(nextState.elements);
      setHistoryIndex(newIndex);
      setIsUndoRedoAction(true);
      
      // Emit redo action to other users
      socket?.emit('redo-action', { roomId: room.roomId, elements: nextState.elements });
    }
  }, [historyIndex, history, socket, room.roomId]);

  // Check if undo/redo is available
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent default behavior for these shortcuts
      if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'y')) {
        event.preventDefault();
      }

      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        handleUndo();
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z (or Cmd+Shift+Z on Mac)
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history.length, handleUndo, handleRedo]);

  useEffect(() => {
    if (!socket) return;

    // Join the room
    socket.emit('join-room', { roomId: room.roomId, userName });

    // Listen for room data
    socket.on('room-joined', (data: { room: Room; users: User[] }) => {
      const initialElements = data.room.elements || [];
      setElements(initialElements);
      setUsers(data.users);
      
      // Initialize history with current state
      const initialHistoryState: HistoryState = {
        elements: [...initialElements],
        timestamp: Date.now()
      };
      setHistory([initialHistoryState]);
      setHistoryIndex(0);
    });

    // Listen for new users joining
    socket.on('user-joined', (data: { user: User }) => {
      setUsers(prev => [...prev, data.user]);
    });

    // Listen for users leaving
    socket.on('user-left', (data: { userId: string; userName: string }) => {
      setUsers(prev => prev.filter(user => user.id !== data.userId));
    });

    // Listen for new elements
    socket.on('element-drawn', (data: { element: WhiteboardElement }) => {
      setElements(prev => {
        const newElements = [...prev, data.element];
        addToHistory(newElements);
        return newElements;
      });
    });

    // Listen for element updates
    socket.on('element-updated', (data: { elementId: string; updates: Partial<WhiteboardElement> }) => {
      setElements(prev => {
        const newElements = prev.map(el => 
          el.id === data.elementId ? { ...el, ...data.updates } : el
        );
        addToHistory(newElements);
        return newElements;
      });
    });

    // Listen for element deletions
    socket.on('element-deleted', (data: { elementId: string }) => {
      setElements(prev => {
        const newElements = prev.filter(el => el.id !== data.elementId);
        addToHistory(newElements);
        return newElements;
      });
    });

    // Listen for cursor movements
    socket.on('cursor-moved', (data: { userId: string; userName: string; cursor: { x: number; y: number } }) => {
      setUsers(prev => 
        prev.map(user => 
          user.id === data.userId 
            ? { ...user, cursor: data.cursor }
            : user
        )
      );
    });

    // Listen for text input
    socket.on('text-input', (data: { element: WhiteboardElement }) => {
      setElements(prev => {
        const existingIndex = prev.findIndex(el => el.id === data.element.id);
        let newElements;
        if (existingIndex !== -1) {
          newElements = [...prev];
          newElements[existingIndex] = data.element;
        } else {
          newElements = [...prev, data.element];
        }
        addToHistory(newElements);
        return newElements;
      });
    });

    // Listen for undo actions from other users
    socket.on('undo-action', (data: { elements: WhiteboardElement[] }) => {
      setElements(data.elements);
      setIsUndoRedoAction(true);
    });

    // Listen for redo actions from other users
    socket.on('redo-action', (data: { elements: WhiteboardElement[] }) => {
      setElements(data.elements);
      setIsUndoRedoAction(true);
    });

    return () => {
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('element-drawn');
      socket.off('element-updated');
      socket.off('element-deleted');
      socket.off('cursor-moved');
      socket.off('text-input');
      socket.off('undo-action');
      socket.off('redo-action');
    };
  }, [socket, room.roomId, userName, addToHistory]);

  const handleElementCreated = (element: WhiteboardElement) => {
    const newElements = [...elements, element];
    setElements(newElements);
    addToHistory(newElements);
    socket?.emit('draw-element', { roomId: room.roomId, element });
  };

  const handleElementUpdated = (elementId: string, updates: Partial<WhiteboardElement>) => {
    const newElements = elements.map(el => 
      el.id === elementId ? { ...el, ...updates } : el
    );
    setElements(newElements);
    addToHistory(newElements);
    socket?.emit('update-element', { roomId: room.roomId, elementId, updates });
  };

  const handleElementDeleted = (elementId: string) => {
    const newElements = elements.filter(el => el.id !== elementId);
    setElements(newElements);
    addToHistory(newElements);
    socket?.emit('delete-element', { roomId: room.roomId, elementId });
  };

  const handleCursorMove = (cursor: { x: number; y: number }) => {
    socket?.emit('cursor-move', { roomId: room.roomId, cursor });
  };

  const handleTextInput = (element: WhiteboardElement) => {
    socket?.emit('text-input', { roomId: room.roomId, element });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">{room.name}</h1>
            <p className="text-sm text-gray-500">Room ID: {room.roomId}</p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Connected as: {userName}</span>
            <button
              onClick={onLeaveRoom}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Toolbar */}
        <div className="w-16 bg-white shadow-sm border-r">
          <Toolbar
            selectedTool={selectedTool}
            onToolChange={setSelectedTool}
            color={color}
            onColorChange={setColor}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={setStrokeWidth}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <Canvas
            elements={elements}
            selectedTool={selectedTool}
            color={color}
            strokeWidth={strokeWidth}
            onElementCreated={handleElementCreated}
            onElementUpdated={handleElementUpdated}
            onElementDeleted={handleElementDeleted}
            onCursorMove={handleCursorMove}
            onTextInput={handleTextInput}
          />
        </div>

        {/* User List */}
        <div className="w-64 bg-white shadow-sm border-l">
          <UserList users={users} currentUser={userName} />
        </div>
      </div>
    </div>
  );
};

export default Whiteboard; 