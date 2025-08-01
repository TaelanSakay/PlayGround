import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  action: string; // Track what action was performed
}

const Whiteboard: React.FC<WhiteboardProps> = ({ room, userName, onLeaveRoom }) => {
  const [elements, setElements] = useState<WhiteboardElement[]>(room.elements || []);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTool, setSelectedTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#FFFFFF'); // New: fill color state
  const [strokeWidth, setStrokeWidth] = useState(2);
  
  // Improved history management for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);
  const [isExternalAction, setIsExternalAction] = useState(false);
  
  // Refs for managing updates
  const pendingUpdates = useRef<Map<string, WhiteboardElement>>(new Map());
  const updateTimeouts = useRef<Map<string, number>>(new Map());
  const lastElementsRef = useRef<WhiteboardElement[]>([]);
  
  // Cursor timeout for stopping cursor updates
  const cursorTimeoutRef = useRef<number | null>(null);
  
  const socket = useSocket();

  // Download canvas functionality with white background
  const handleDownload = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      // Create a temporary canvas with white background
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Set the same dimensions as the original canvas
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;

      // Fill with white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the original canvas content on top
      tempCtx.drawImage(canvas, 0, 0);

      // Convert to data URL and download
      const dataURL = tempCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `whiteboard-${room.roomId}-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [room.roomId]);

  // Enhanced add to history with better tracking
  const addToHistory = useCallback((newElements: WhiteboardElement[], action: string = 'modify') => {
    if (isUndoRedoAction || isExternalAction) {
      setIsUndoRedoAction(false);
      setIsExternalAction(false);
      return;
    }

    // Don't add to history if elements haven't actually changed
    const elementsChanged = JSON.stringify(newElements) !== JSON.stringify(lastElementsRef.current);
    if (!elementsChanged) return;

    lastElementsRef.current = newElements;

    const newHistoryState: HistoryState = {
      elements: [...newElements],
      timestamp: Date.now(),
      action
    };

    setHistory(prev => {
      const updatedHistory = prev.slice(0, historyIndex + 1);
      // Limit history size to prevent memory issues
      const maxHistory = 50;
      if (updatedHistory.length >= maxHistory) {
        updatedHistory.shift();
        setHistoryIndex(prev => Math.max(0, prev - 1));
        return [...updatedHistory, newHistoryState];
      }
      return [...updatedHistory, newHistoryState];
    });
    setHistoryIndex(prev => prev + 1);
  }, [isUndoRedoAction, isExternalAction, historyIndex]);

  // Enhanced undo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      setElements(previousState.elements);
      setHistoryIndex(newIndex);
      setIsUndoRedoAction(true);
      
      // Sync with other users
      socket?.emit('undo-action', { 
        roomId: room.roomId, 
        elements: previousState.elements,
        action: 'undo'
      });
    }
  }, [historyIndex, history, socket, room.roomId]);

  // Enhanced redo functionality
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setElements(nextState.elements);
      setHistoryIndex(newIndex);
      setIsUndoRedoAction(true);
      
      // Sync with other users
      socket?.emit('redo-action', { 
        roomId: room.roomId, 
        elements: nextState.elements,
        action: 'redo'
      });
    }
  }, [historyIndex, history, socket, room.roomId]);

  // Clear canvas - Enhanced with proper history tracking
  const handleClear = useCallback(() => {
    console.log('Clear button clicked');
    
    // Update local state immediately for responsive feel
    setElements([]);
    addToHistory([], 'clear');
    lastElementsRef.current = [];
    
    // Then notify server
    socket?.emit('clear-canvas', { roomId: room.roomId });
  }, [socket, room.roomId, addToHistory]);

  // Check if undo/redo is available
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'y')) {
        event.preventDefault();
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        handleUndo();
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Cleanup cursor timeout
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [handleUndo, handleRedo]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.emit('join-room', { roomId: room.roomId, userName });

    // Room joined
    socket.on('room-joined', (data: { room: Room; users: User[] }) => {
      console.log('Room joined, elements received:', data.room.elements?.length || 0);
      setElements(data.room.elements || []);
      setUsers(data.users);
      
      const initialHistoryState: HistoryState = {
        elements: [...(data.room.elements || [])],
        timestamp: Date.now(),
        action: 'initial'
      };
      setHistory([initialHistoryState]);
      setHistoryIndex(0);
      lastElementsRef.current = data.room.elements || [];
    });

    // User events - improved to prevent duplicates
    socket.on('user-joined', (data: { user: User }) => {
      setUsers(prev => {
        // Check if user already exists
        const existingUser = prev.find(user => user.id === data.user.id);
        if (existingUser) {
          // Update existing user
          return prev.map(user => 
            user.id === data.user.id ? data.user : user
          );
        } else {
          // Add new user
          return [...prev, data.user];
        }
      });
    });

    socket.on('user-left', (data: { userId: string }) => {
      setUsers(prev => prev.filter(user => user.id !== data.userId));
    });

    // Element events - improved handling
    socket.on('element-drawn', (data: { element: WhiteboardElement }) => {
      console.log('Element drawn received:', data.element.id, data.element.type);
      setElements(prev => {
        const existingIndex = prev.findIndex(el => el.id === data.element.id);
        if (existingIndex !== -1) {
          // Update existing element
          const newElements = [...prev];
          newElements[existingIndex] = data.element;
          return newElements;
        } else {
          // Add new element
          return [...prev, data.element];
        }
      });
    });

    socket.on('element-updated', (data: { elementId: string; updates: Partial<WhiteboardElement> | WhiteboardElement }) => {
      console.log('Element updated received:', data.elementId);
      setElements(prev => {
        return prev.map(el => {
          if (el.id === data.elementId) {
            // Handle both full element and partial updates
            return 'type' in data.updates ? data.updates as WhiteboardElement : { ...el, ...data.updates };
          }
          return el;
        });
      });
    });

    // Handle element completion (for adding to history)
    socket.on('element-completed', (data: { element: WhiteboardElement }) => {
      console.log('Element completed received:', data.element.id);
      setElements(prev => {
        const newElements = prev.map(el => 
          el.id === data.element.id ? data.element : el
        );
        // Add to history when element is completed
        setTimeout(() => addToHistory(newElements, 'draw'), 100);
        return newElements;
      });
    });

    socket.on('element-deleted', (data: { elementId?: string; elements: WhiteboardElement[] }) => {
      console.log('Element deleted received:', data.elementId || 'multiple');
      setElements(data.elements);
      // Add to history after deletion
      setTimeout(() => addToHistory(data.elements, 'delete'), 100);
    });

    // Cursor movement - improved user management
    socket.on('cursor-moved', (data: { userId: string; userName: string; cursor: { x: number; y: number } }) => {
      setUsers(prev => {
        const newUsers = [...prev];
        const userIndex = newUsers.findIndex(user => user.id === data.userId);
        
        if (userIndex !== -1) {
          // Update existing user
          newUsers[userIndex] = { ...newUsers[userIndex], cursor: data.cursor };
        } else {
          // Add new user if not found
          newUsers.push({
            id: data.userId,
            name: data.userName,
            cursor: data.cursor
          });
        }
        
        return newUsers;
      });
    });

    socket.on('cursor-stopped', (data: { userId: string }) => {
      setUsers(prev => {
        const newUsers = [...prev];
        const userIndex = newUsers.findIndex(user => user.id === data.userId);
        
        if (userIndex !== -1) {
          newUsers[userIndex] = { ...newUsers[userIndex], cursor: null };
        }
        
        return newUsers;
      });
    });

    // Enhanced undo/Redo from other users
    socket.on('undo-action', (data: { elements: WhiteboardElement[]; action?: string }) => {
      console.log('Undo action received from another user');
      setElements(data.elements);
      setIsExternalAction(true);
      
      // Clear history for other users to prevent conflicts
      setHistory([]);
      setHistoryIndex(-1);
    });

    socket.on('redo-action', (data: { elements: WhiteboardElement[]; action?: string }) => {
      console.log('Redo action received from another user');
      setElements(data.elements);
      setIsExternalAction(true);
      
      // Clear history for other users to prevent conflicts
      setHistory([]);
      setHistoryIndex(-1);
    });

    // Clear canvas - improved handling
    socket.on('canvas-cleared', (data: { elements: WhiteboardElement[] }) => {
      console.log('Canvas cleared event received');
      setElements(data.elements); // Should be empty array
      lastElementsRef.current = data.elements;
      
      // Clear the actual canvas context
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      // Add to history
      setTimeout(() => addToHistory(data.elements, 'clear'), 100);
    });

    // Enhanced text handling
    socket.on('text-updated', (data: { element: WhiteboardElement }) => {
      console.log('Text updated received:', data.element.id, data.element.text);
      setElements(prev => {
        const existingIndex = prev.findIndex(el => el.id === data.element.id);
        if (existingIndex !== -1) {
          const newElements = [...prev];
          newElements[existingIndex] = data.element;
          return newElements;
        } else {
          return [...prev, data.element];
        }
      });
    });

    return () => {
      socket.off('room-joined');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('element-drawn');
      socket.off('element-updated');
      socket.off('element-completed');
      socket.off('element-deleted');
      socket.off('cursor-moved');
      socket.off('cursor-stopped');
      socket.off('undo-action');
      socket.off('redo-action');
      socket.off('canvas-cleared');
      socket.off('text-updated');
      
      // Cleanup cursor timeout
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [socket, room.roomId, userName, addToHistory]);

  // Element creation handler - improved
  const handleElementCreated = useCallback((element: WhiteboardElement) => {
    console.log('Element created locally:', element.id, element.type);
    
    // Add locally immediately for responsive feel
    setElements(prev => {
      const existingIndex = prev.findIndex(el => el.id === element.id);
      if (existingIndex !== -1) {
        // Update existing
        const newElements = [...prev];
        newElements[existingIndex] = element;
        return newElements;
      } else {
        // Add new
        return [...prev, element];
      }
    });
    
    // Send to server
    socket?.emit('draw-element', { roomId: room.roomId, element });
  }, [socket, room.roomId]);

  // Element update handler with improved batching
  const handleElementUpdated = useCallback((elementId: string, updates: Partial<WhiteboardElement> | WhiteboardElement) => {
    console.log('Element updated locally:', elementId);
    
    // Update locally immediately
    setElements(prev => prev.map(el => 
      el.id === elementId ? ('type' in updates ? updates as WhiteboardElement : { ...el, ...updates }) : el
    ));

    // Batch updates to server
    const updatedElement = 'type' in updates ? updates : { ...elements.find(el => el.id === elementId), ...updates };
    pendingUpdates.current.set(elementId, updatedElement as WhiteboardElement);

    // Clear existing timeout
    const existingTimeout = updateTimeouts.current.get(elementId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout for batched update
    const timeout = setTimeout(() => {
      const element = pendingUpdates.current.get(elementId);
      if (element) {
        console.log('Sending batched update for:', elementId);
        socket?.emit('update-element', { roomId: room.roomId, elementId, updates: element });
        pendingUpdates.current.delete(elementId);
        updateTimeouts.current.delete(elementId);
      }
    }, 50); // 50ms debounce

    updateTimeouts.current.set(elementId, timeout);
  }, [socket, room.roomId, elements]);

  // Element completion handler - improved
  const handleElementCompleted = useCallback((elementId: string, completedElement: WhiteboardElement) => {
    console.log('Element completed locally:', elementId);
    
    // Clear any pending updates
    const existingTimeout = updateTimeouts.current.get(elementId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      updateTimeouts.current.delete(elementId);
    }
    pendingUpdates.current.delete(elementId);

    // Update locally
    setElements(prev => {
      const newElements = prev.map(el => el.id === elementId ? completedElement : el);
      // Add to history when element is completed
      setTimeout(() => addToHistory(newElements, 'complete'), 100);
      return newElements;
    });

    // Send final state to server - use update-element for completion
    socket?.emit('update-element', { roomId: room.roomId, elementId, updates: completedElement });
  }, [socket, room.roomId, addToHistory]);

  // Element deletion handler - improved
  const handleElementDeleted = useCallback((elementId: string) => {
    console.log('Element deleted locally:', elementId);
    
    setElements(prev => {
      const newElements = prev.filter(el => el.id !== elementId);
      // Add to history after deletion
      setTimeout(() => addToHistory(newElements, 'delete'), 100);
      return newElements;
    });
    
    socket?.emit('delete-element', { roomId: room.roomId, elementId });
  }, [socket, room.roomId, addToHistory]);

  // Cursor movement handler with timeout
  const handleCursorMove = useCallback((cursor: { x: number; y: number }) => {
    socket?.emit('cursor-move', { roomId: room.roomId, cursor });
    
    // Clear existing timeout
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }
    
    // Set new timeout to stop cursor
    cursorTimeoutRef.current = setTimeout(() => {
      socket?.emit('cursor-stopped', { roomId: room.roomId });
      cursorTimeoutRef.current = null;
    }, 1000); // 1 second delay
  }, [socket, room.roomId]);

  // Enhanced text input handler
  const handleTextInput = useCallback((element: WhiteboardElement) => {
    console.log('Text input locally:', element.id, element.text);
    
    // Update locally immediately
    setElements(prev => {
      const existingIndex = prev.findIndex(el => el.id === element.id);
      if (existingIndex !== -1) {
        const newElements = [...prev];
        newElements[existingIndex] = element;
        return newElements;
      } else {
        return [...prev, element];
      }
    });
    
    // Send to server
    socket?.emit('text-input', { roomId: room.roomId, element });
  }, [socket, room.roomId]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Fun Header */}
      <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white py-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-wider animate-pulse">
            <span className="inline-block transform hover:scale-110 transition-transform">P</span>
            <span className="inline-block transform hover:scale-110 transition-transform">l</span>
            <span className="inline-block transform hover:scale-110 transition-transform">a</span>
            <span className="inline-block transform hover:scale-110 transition-transform">y</span>
            <span className="inline-block transform hover:scale-110 transition-transform">G</span>
            <span className="inline-block transform hover:scale-110 transition-transform">r</span>
            <span className="inline-block transform hover:scale-110 transition-transform">o</span>
            <span className="inline-block transform hover:scale-110 transition-transform">u</span>
            <span className="inline-block transform hover:scale-110 transition-transform">n</span>
            <span className="inline-block transform hover:scale-110 transition-transform">d</span>
          </h1>
          <p className="text-sm mt-2 opacity-90">Collaborative Whiteboard</p>
        </div>
      </div>

      {/* Room Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{room.name}</h2>
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
        <Toolbar
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          color={color}
          onColorChange={setColor}
          fillColor={fillColor}
          onFillColorChange={setFillColor}
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onDownload={handleDownload}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <Canvas
            elements={elements}
            selectedTool={selectedTool}
            color={color}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            onElementCreated={handleElementCreated}
            onElementUpdated={handleElementUpdated}
            onElementDeleted={handleElementDeleted}
            onElementCompleted={handleElementCompleted}
            onCursorMove={handleCursorMove}
            onTextInput={handleTextInput}
            socket={socket}
            currentRoom={room}
            onClearCanvas={handleClear}
            users={users}
            currentUserId={socket?.id}
          />
        </div>

        {/* User List */}
        <UserList users={users} currentUser={userName} />
      </div>
    </div>
  );
};

export default Whiteboard;