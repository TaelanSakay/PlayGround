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
  
  // Refs for managing updates
  const pendingUpdates = useRef<Map<string, WhiteboardElement>>(new Map());
  const updateTimeouts = useRef<Map<string, number>>(new Map());
  
  const socket = useSocket();

  // Filter valid elements
  const filterValidElements = useCallback((elements: WhiteboardElement[]): WhiteboardElement[] => {
    return elements.filter(element => {
      if (!element.id || !element.type) return false;
      
      switch (element.type) {
        case 'drawing':
          return element.points && element.points.length >= 1;
        case 'text':
          return element.text !== undefined;
        case 'shape':
          return element.width !== undefined && element.height !== undefined;
        default:
          return false;
      }
    });
  }, []);

  // Add to history with debouncing
  const addToHistory = useCallback((newElements: WhiteboardElement[]) => {
    if (isUndoRedoAction) {
      setIsUndoRedoAction(false);
      return;
    }

    const validElements = filterValidElements(newElements);
    const newHistoryState: HistoryState = {
      elements: [...validElements],
      timestamp: Date.now()
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
  }, [isUndoRedoAction, historyIndex, filterValidElements]);

  // Undo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      const validElements = filterValidElements(previousState.elements);
      setElements(validElements);
      setHistoryIndex(newIndex);
      setIsUndoRedoAction(true);
      
      socket?.emit('undo-action', { roomId: room.roomId, elements: validElements });
    }
  }, [historyIndex, history, socket, room.roomId, filterValidElements]);

  // Redo functionality
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      const validElements = filterValidElements(nextState.elements);
      setElements(validElements);
      setHistoryIndex(newIndex);
      setIsUndoRedoAction(true);
      
      socket?.emit('redo-action', { roomId: room.roomId, elements: validElements });
    }
  }, [historyIndex, history, socket, room.roomId, filterValidElements]);

  // Clear canvas
  const handleClear = useCallback(() => {
    console.log('Clear button clicked');
    setElements([]);
    addToHistory([]);
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.emit('join-room', { roomId: room.roomId, userName });

    // Room joined
    socket.on('room-joined', (data: { room: Room; users: User[] }) => {
      const initialElements = filterValidElements(data.room.elements || []);
      setElements(initialElements);
      setUsers(data.users);
      
      const initialHistoryState: HistoryState = {
        elements: [...initialElements],
        timestamp: Date.now()
      };
      setHistory([initialHistoryState]);
      setHistoryIndex(0);
    });

    // User events
    socket.on('user-joined', (data: { user: User }) => {
      setUsers(prev => [...prev, data.user]);
    });

    socket.on('user-left', (data: { userId: string }) => {
      setUsers(prev => prev.filter(user => user.id !== data.userId));
    });

    // Element events
    socket.on('element-drawn', (data: { element: WhiteboardElement }) => {
      setElements(prev => {
        const existingIndex = prev.findIndex(el => el.id === data.element.id);
        let newElements;
        
        if (existingIndex !== -1) {
          newElements = [...prev];
          newElements[existingIndex] = data.element;
        } else {
          newElements = [...prev, data.element];
        }
        
        const validElements = filterValidElements(newElements);
        return validElements;
      });
    });

    socket.on('element-updated', (data: { elementId: string; updates: Partial<WhiteboardElement> | WhiteboardElement }) => {
      setElements(prev => {
        const newElements = prev.map(el => {
          if (el.id === data.elementId) {
            return 'type' in data.updates ? data.updates as WhiteboardElement : { ...el, ...data.updates };
          }
          return el;
        });
        return filterValidElements(newElements);
      });
    });

    socket.on('element-completed', (data: { element: WhiteboardElement }) => {
      setElements(prev => {
        const newElements = prev.map(el => 
          el.id === data.element.id ? data.element : el
        );
        const validElements = filterValidElements(newElements);
        addToHistory(validElements);
        return validElements;
      });
    });

    socket.on('element-deleted', (data: { elementId: string }) => {
      setElements(prev => {
        const newElements = prev.filter(el => el.id !== data.elementId);
        const validElements = filterValidElements(newElements);
        addToHistory(validElements);
        return validElements;
      });
    });

    // Cursor movement
    socket.on('cursor-moved', (data: { userId: string; userName: string; cursor: { x: number; y: number } }) => {
      setUsers(prev => 
        prev.map(user => 
          user.id === data.userId ? { ...user, cursor: data.cursor } : user
        )
      );
    });

    // Undo/Redo from other users
    socket.on('undo-action', (data: { elements: WhiteboardElement[] }) => {
      const validElements = filterValidElements(data.elements);
      setElements(validElements);
      setIsUndoRedoAction(true);
    });

    socket.on('redo-action', (data: { elements: WhiteboardElement[] }) => {
      const validElements = filterValidElements(data.elements);
      setElements(validElements);
      setIsUndoRedoAction(true);
    });

    // Clear canvas
    socket.on('canvas-cleared', () => {
      console.log('Canvas cleared event received');
      setElements([]);
      addToHistory([]);
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
      socket.off('undo-action');
      socket.off('redo-action');
      socket.off('canvas-cleared');
    };
  }, [socket, room.roomId, userName, filterValidElements, addToHistory]);

  // Element creation handler
  const handleElementCreated = useCallback((element: WhiteboardElement) => {
    // Add locally immediately for responsive feel
    setElements(prev => [...prev, element]);
    
    // Send to server
    socket?.emit('draw-element', { roomId: room.roomId, element });
  }, [socket, room.roomId]);

  // Element update handler with batching
  const handleElementUpdated = useCallback((elementId: string, updates: Partial<WhiteboardElement> | WhiteboardElement) => {
    // Update locally immediately
    setElements(prev => prev.map(el => 
      el.id === elementId ? { ...el, ...updates } : el
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
        socket?.emit('update-element', { roomId: room.roomId, elementId, updates: element });
        pendingUpdates.current.delete(elementId);
        updateTimeouts.current.delete(elementId);
      }
    }, 50); // 50ms debounce

    updateTimeouts.current.set(elementId, timeout);
  }, [socket, room.roomId, elements]);

  // Element completion handler
  const handleElementCompleted = useCallback((elementId: string, completedElement: WhiteboardElement) => {
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
      const validElements = filterValidElements(newElements);
      addToHistory(validElements);
      return validElements;
    });

    // Send to server
    socket?.emit('complete-element', { roomId: room.roomId, elementId, element: completedElement });
  }, [socket, room.roomId, filterValidElements, addToHistory]);

  // Element deletion handler
  const handleElementDeleted = useCallback((elementId: string) => {
    setElements(prev => {
      const newElements = prev.filter(el => el.id !== elementId);
      const validElements = filterValidElements(newElements);
      addToHistory(validElements);
      return validElements;
    });
    
    socket?.emit('delete-element', { roomId: room.roomId, elementId });
  }, [socket, room.roomId, filterValidElements, addToHistory]);

  // Cursor movement handler
  const handleCursorMove = useCallback((cursor: { x: number; y: number }) => {
    socket?.emit('cursor-move', { roomId: room.roomId, cursor });
  }, [socket, room.roomId]);

  // Text input handler
  const handleTextInput = useCallback((element: WhiteboardElement) => {
    socket?.emit('text-input', { roomId: room.roomId, element });
  }, [socket, room.roomId]);

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
            onClear={handleClear}
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
            onElementCompleted={handleElementCompleted}
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