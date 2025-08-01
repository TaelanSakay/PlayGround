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
  action: string;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ room, userName, onLeaveRoom }) => {
  const [elements, setElements] = useState<WhiteboardElement[]>(room.elements || []);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTool, setSelectedTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(2);
  
  // History management
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Refs for managing updates
  const isRemoteUpdate = useRef(false);
  const isPerformingUndoRedo = useRef(false);
  const lastElementsRef = useRef<WhiteboardElement[]>([]);
  const cursorTimeoutRef = useRef<number | null>(null);
  const pendingUpdates = useRef<Map<string, WhiteboardElement>>(new Map());
  const updateTimeouts = useRef<Map<string, number>>(new Map());
  
  const socket = useSocket();

  // Download canvas functionality
  const handleDownload = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);

      const dataURL = tempCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `whiteboard-${room.roomId}-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [room.roomId]);

  // Centralized history management
  const addToHistory = useCallback((newElements: WhiteboardElement[], action: string = 'modify') => {
    // Don't add to history during undo/redo operations or remote updates
    if (isPerformingUndoRedo.current || isRemoteUpdate.current) {
      return;
    }

    // Don't add if elements haven't changed
    const elementsStr = JSON.stringify(newElements.map(el => ({ id: el.id, type: el.type, x: el.x, y: el.y })));
    const lastElementsStr = JSON.stringify(lastElementsRef.current.map(el => ({ id: el.id, type: el.type, x: el.x, y: el.y })));
    
    if (elementsStr === lastElementsStr) {
      return;
    }

    lastElementsRef.current = [...newElements];

    const newHistoryState: HistoryState = {
      elements: JSON.parse(JSON.stringify(newElements)), // Deep copy
      timestamp: Date.now(),
      action
    };

    setHistory(prev => {
      // Remove any future history when adding new state
      const updatedHistory = prev.slice(0, historyIndex + 1);
      
      // Limit history size
      const maxHistory = 50;
      if (updatedHistory.length >= maxHistory) {
        updatedHistory.shift();
        return [...updatedHistory, newHistoryState];
      }
      
      return [...updatedHistory, newHistoryState];
    });
    
    setHistoryIndex(prev => {
      const newIndex = Math.min(prev + 1, 49); // Max index
      return newIndex;
    });
  }, [historyIndex]);

  // Undo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0 || history.length === 0) return;
    const previousIndex = historyIndex - 1;
    const previousState = history[previousIndex];
    if (!previousState) return;
  
    isPerformingUndoRedo.current = true;
    lastElementsRef.current = [...previousState.elements];
    setElements(previousState.elements);
    setHistoryIndex(previousIndex);
  
    socket?.emit("undo-action", {
      roomId: room.roomId,
      elements: previousState.elements,
    });
  
    setTimeout(() => {
      isPerformingUndoRedo.current = false;
    }, 100);
  }, [historyIndex, history, socket, room.roomId]);

  // Redo functionality
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) {
      console.log('Cannot redo: historyIndex =', historyIndex, 'history.length =', history.length);
      return;
    }

    const nextIndex = historyIndex + 1;
    const nextState = history[nextIndex];
    
    if (!nextState) {
      console.log('No next state found');
      return;
    }

    console.log('Performing redo, going to index:', nextIndex);
    
    isPerformingUndoRedo.current = true;
    setElements(nextState.elements);
    setHistoryIndex(nextIndex);
    lastElementsRef.current = [...nextState.elements];
    
    // Sync with server and other users
    socket?.emit('redo-action', { 
      roomId: room.roomId, 
      elements: nextState.elements
    });

    setTimeout(() => {
      isPerformingUndoRedo.current = false;
    }, 100);
  }, [historyIndex, history, socket, room.roomId]);

  // Clear canvas
  const handleClear = useCallback(() => {
    console.log('Clear button clicked');
    
    setElements([]);
    addToHistory([], 'clear');
    lastElementsRef.current = [];
    
    socket?.emit('clear-canvas', { roomId: room.roomId });
  }, [socket, room.roomId, addToHistory]);

  // Check if undo/redo is available
  const canUndo = historyIndex > 0 && history.length > 0;
  const canRedo = historyIndex < history.length - 1 && history.length > 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'y')) {
        event.preventDefault();
        
        if (event.key === 'z' && !event.shiftKey) {
          handleUndo();
        } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [handleUndo, handleRedo]);

  // Centralized history management - useEffect that watches elements changes
  useEffect(() => {
    // Only add to history for local updates (not remote updates or undo/redo)
    if (!isRemoteUpdate.current && !isPerformingUndoRedo.current) {
      const timeout = setTimeout(() => {
        addToHistory(elements, 'modify');
      }, 150);
  
      return () => clearTimeout(timeout);
    }
  }, [elements, addToHistory]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    socket.emit('join-room', { roomId: room.roomId, userName });

    // Room joined - Initialize history
    socket.on('room-joined', (data: { room: Room; users: User[] }) => {
      console.log('Room joined, elements received:', data.room.elements?.length || 0);
      const initialElements = data.room.elements || [];
      
      isRemoteUpdate.current = true;
      setElements(initialElements);
      setUsers(data.users);
      
      // Initialize history with current state
      const initialHistoryState: HistoryState = {
        elements: JSON.parse(JSON.stringify(initialElements)),
        timestamp: Date.now(),
        action: 'initial'
      };
      
      setHistory([initialHistoryState]);
      setHistoryIndex(0);
      lastElementsRef.current = [...initialElements];
      
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 100);
    });

    // User events
    socket.on('user-joined', (data: { user: User }) => {
      setUsers(prev => {
        const existingUser = prev.find(user => user.id === data.user.id);
        if (existingUser) {
          return prev.map(user => 
            user.id === data.user.id ? data.user : user
          );
        } else {
          return [...prev, data.user];
        }
      });
    });

    socket.on('user-left', (data: { userId: string }) => {
      setUsers(prev => prev.filter(user => user.id !== data.userId));
    });

    // Element events - Mark as remote updates
    socket.on('element-drawn', (data: { element: WhiteboardElement }) => {
      console.log('Element drawn received:', data.element.id, data.element.type);
      isRemoteUpdate.current = true;
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
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 50);
    });

    socket.on('element-updated', (data: { elementId: string; updates: Partial<WhiteboardElement> | WhiteboardElement }) => {
      isRemoteUpdate.current = true;
      setElements(prev => {
        return prev.map(el => {
          if (el.id === data.elementId) {
            return 'type' in data.updates ? data.updates as WhiteboardElement : { ...el, ...data.updates };
          }
          return el;
        });
      });
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 50);
    });

    socket.on('element-completed', (data: { element: WhiteboardElement }) => {
      console.log('Element completed received:', data.element.id);
      isRemoteUpdate.current = true;
      setElements(prev => {
        return prev.map(el => 
          el.id === data.element.id ? data.element : el
        );
      });
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 50);
    });

    socket.on('element-deleted', (data: { elementId?: string; elements: WhiteboardElement[] }) => {
      console.log('Element deleted received:', data.elementId || 'multiple');
      isRemoteUpdate.current = true;
      setElements(data.elements);
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 50);
    });

    // Handle undo/redo from other users
    socket.on('undo-action', (data: { elements: WhiteboardElement[] }) => {
      console.log('Undo action received from another user');
      isPerformingUndoRedo.current = true;
      isRemoteUpdate.current = true;
      setElements(data.elements);
      lastElementsRef.current = [...data.elements];
      
      setTimeout(() => {
        isPerformingUndoRedo.current = false;
        isRemoteUpdate.current = false;
      }, 100);
    });

    socket.on('redo-action', (data: { elements: WhiteboardElement[] }) => {
      console.log('Redo action received from another user');
      isPerformingUndoRedo.current = true;
      isRemoteUpdate.current = true;
      setElements(data.elements);
      lastElementsRef.current = [...data.elements];
      
      setTimeout(() => {
        isPerformingUndoRedo.current = false;
        isRemoteUpdate.current = false;
      }, 100);
    });

    // Cursor events
    socket.on('cursor-moved', (data: { userId: string; userName: string; cursor: { x: number; y: number } }) => {
      setUsers(prev => {
        const newUsers = [...prev];
        const userIndex = newUsers.findIndex(user => user.id === data.userId);
        
        if (userIndex !== -1) {
          newUsers[userIndex] = { ...newUsers[userIndex], cursor: data.cursor };
        } else {
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

    // Clear canvas
    socket.on('canvas-cleared', (data: { elements: WhiteboardElement[] }) => {
      console.log('Canvas cleared event received');
      isRemoteUpdate.current = true;
      setElements(data.elements);
      lastElementsRef.current = data.elements;
      
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 50);
    });

    // Text events
    socket.on('text-updated', (data: { element: WhiteboardElement }) => {
      console.log('Text updated received:', data.element.id, data.element.text);
      isRemoteUpdate.current = true;
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
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 50);
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
      
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, [socket, room.roomId, userName]);

  // Element handlers
  const handleElementCreated = useCallback((element: WhiteboardElement) => {
    console.log('Element created locally:', element.id, element.type);
    
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
    
    socket?.emit('draw-element', { roomId: room.roomId, element });
  }, [socket, room.roomId]);

  const handleElementUpdated = useCallback((elementId: string, updates: Partial<WhiteboardElement> | WhiteboardElement) => {
    setElements(prev => prev.map(el => 
      el.id === elementId ? ('type' in updates ? updates as WhiteboardElement : { ...el, ...updates }) : el
    ));

    const updatedElement = 'type' in updates ? updates : { ...elements.find(el => el.id === elementId), ...updates };
    pendingUpdates.current.set(elementId, updatedElement as WhiteboardElement);

    const existingTimeout = updateTimeouts.current.get(elementId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      const element = pendingUpdates.current.get(elementId);
      if (element) {
        socket?.emit('update-element', { roomId: room.roomId, elementId, updates: element });
        pendingUpdates.current.delete(elementId);
        updateTimeouts.current.delete(elementId);
      }
    }, 50);

    updateTimeouts.current.set(elementId, timeout);
  }, [socket, room.roomId, elements]);

  const handleElementCompleted = useCallback((elementId: string, completedElement: WhiteboardElement) => {
    const newElements = elements.map(el => el.id === elementId ? completedElement : el);
    setElements(newElements);
    addToHistory(newElements, "complete");
    socket?.emit("update-element", { roomId: room.roomId, elementId, updates: completedElement });
  }, [socket, room.roomId, elements, addToHistory]);

  const handleElementDeleted = useCallback((elementId: string) => {
    console.log('Element deleted locally:', elementId)
    
    setElements(prev => {
      const newElements = prev.filter(el => el.id !== elementId);
      addToHistory(newElements, 'delete');
      return newElements;
    });
    
    socket?.emit('delete-element', { roomId: room.roomId, elementId });
  }, [socket, room.roomId, addToHistory]);

  const handleCursorMove = useCallback((cursor: { x: number; y: number }) => {
    socket?.emit('cursor-move', { roomId: room.roomId, cursor });
    
    if (cursorTimeoutRef.current) {
      clearTimeout(cursorTimeoutRef.current);
    }
    
    cursorTimeoutRef.current = setTimeout(() => {
      socket?.emit('cursor-stopped', { roomId: room.roomId });
      cursorTimeoutRef.current = null;
    }, 1000);
  }, [socket, room.roomId]);

  const handleTextInput = useCallback((element: WhiteboardElement) => {
    console.log('Text input locally:', element.id, element.text);
    
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
    
    socket?.emit('text-input', { roomId: room.roomId, element });
  }, [socket, room.roomId]);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
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

        <UserList users={users} currentUser={userName} />
      </div>
    </div>
  );
};

export default Whiteboard;