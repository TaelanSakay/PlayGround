import React, { useEffect, useCallback, useRef } from 'react';
import { WhiteboardElement } from '../types/whiteboard';
import { useNotification } from '../contexts/NotificationContext';

interface UseSocketEventsProps {
  socket: any;
  currentRoom: { roomId: string } | null;
  elements: WhiteboardElement[];
  setElements: React.Dispatch<React.SetStateAction<WhiteboardElement[]>>;
  setCurrentElement: (element: WhiteboardElement | null) => void;
  setIsDrawing: (drawing: boolean) => void;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onElementCreated?: (element: WhiteboardElement) => void;
  onElementUpdated?: (elementId: string, updates: Partial<WhiteboardElement> | WhiteboardElement) => void;
  onElementDeleted?: (elementId: string) => void;
  onElementCompleted?: (elementId: string, completedElement: WhiteboardElement) => void;
  selectedTool?: string;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
}

export const useSocketEvents = ({
  socket,
  currentRoom,
  elements,
  setElements,
  setCurrentElement,
  setIsDrawing,
  canvasRef,
  onElementCreated,
  onElementUpdated,
  onElementDeleted,
  onElementCompleted,
  selectedTool = 'pen',
  color = '#000000',
  fillColor = '#000000',
  strokeWidth = 2
}: UseSocketEventsProps) => {
  const { showNotification } = useNotification();
  
  // Generate unique IDs
  const generateUniqueId = useCallback(() => {
    return `${selectedTool}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, [selectedTool]);

  // Get mouse position relative to canvas
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [canvasRef]);

  // Clear canvas function
  const clearCanvas = useCallback(() => {
    if (!socket || !currentRoom) {
      console.error('Socket or room not available');
      return;
    }
    
    // Emit clear-canvas event to server
    socket.emit('clear-canvas', { roomId: currentRoom.roomId });
    
    // Show loading state
    showNotification('Clearing canvas...', 'info');
  }, [socket, currentRoom, showNotification]);

  // Create shape element with proper shapeType
  const createShapeElement = useCallback((shapeType: string, startX: number, startY: number, color: string, fillColor: string, strokeWidth: number) => {
    const elementId = generateUniqueId();
    
    const baseElement: WhiteboardElement = {
      id: elementId,
      type: 'shape',
      shapeType: shapeType as 'rectangle' | 'circle' | 'line',
      x: startX,
      y: startY,
      color: color,
      fillColor: fillColor,
      strokeWidth: strokeWidth,
      width: 0,
      height: 0,
      timestamp: Date.now(),
      userId: socket?.id || 'current-user',
      isComplete: false
    };
    
    // For lines, initialize with points instead of width/height
    if (shapeType === 'line') {
      baseElement.points = [
        { x: startX, y: startY },
        { x: startX, y: startY } // Start and end at same point initially
      ];
    }
    
    return baseElement;
  }, [generateUniqueId, socket]);

  // Update shape element during drawing
  const updateShapeElement = useCallback((element: WhiteboardElement, currentX: number, currentY: number) => {
    const updatedElement = { ...element };
    
    if (element.shapeType === 'line') {
      // Update end point for line - ensure we always have exactly 2 points
      updatedElement.points = [
        { x: element.x, y: element.y }, // Keep start point
        { x: currentX, y: currentY } // Update end point
      ];
    } else {
      // Update dimensions for rectangle/circle
      updatedElement.width = Math.abs(currentX - element.x);
      updatedElement.height = Math.abs(currentY - element.y);
      
      // Adjust position if dragging up/left
      if (currentX < element.x) {
        updatedElement.x = currentX;
      }
      if (currentY < element.y) {
        updatedElement.y = currentY;
      }
    }
    
    return updatedElement;
  }, []);

  // Enhanced drawing handlers for different tools
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>, currentTool: string, currentColor: string, currentFillColor: string, strokeWidth: number) => {
    if (!socket || !currentRoom) return;

    const pos = getMousePos(e);
    setIsDrawing(true);
    
    // Handle eraser tool
    if (currentTool === 'eraser') {
      console.log('Eraser clicked at:', pos);
      // Find and delete elements at this position
      const elementsToDelete = elements.filter(element => {
        if (element.type === 'drawing' && element.points) {
          return element.points.some(point => {
            const distance = Math.sqrt(
              Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2)
            );
            return distance <= (strokeWidth * 3); // Larger eraser radius
          });
        } else if (element.type === 'shape' && element.width && element.height) {
          const withinX = pos.x >= element.x && pos.x <= element.x + element.width;
          const withinY = pos.y >= element.y && pos.y <= element.y + element.height;
          return withinX && withinY;
        } else if (element.type === 'text') {
          const distance = Math.sqrt(
            Math.pow(element.x - pos.x, 2) + Math.pow(element.y - pos.y, 2)
          );
          return distance <= 30;
        } else if (element.type === 'image') {
          // Handle image erasing
          const withinX = pos.x >= element.x && pos.x <= element.x + (element.width || 100);
          const withinY = pos.y >= element.y && pos.y <= element.y + (element.height || 100);
          return withinX && withinY;
        }
        return false;
      });

      elementsToDelete.forEach(element => {
        console.log('Deleting element:', element.id);
        // Update local state immediately
        setElements((prev: WhiteboardElement[]) => prev.filter(el => el.id !== element.id));
        // Call callback if provided
        onElementDeleted?.(element.id);
        // Emit to server
        socket.emit('delete-element', {
          roomId: currentRoom.roomId,
          elementId: element.id
        });
      });
      
      setIsDrawing(false);
      return;
    }

    // Handle select tool for moving images
    if (currentTool === 'select') {
      // Find element at click position
      const clickedElement = elements.find(element => {
        if (element.type === 'image') {
          const withinX = pos.x >= element.x && pos.x <= element.x + (element.width || 100);
          const withinY = pos.y >= element.y && pos.y <= element.y + (element.height || 100);
          return withinX && withinY;
        }
        return false;
      });

      if (clickedElement) {
        setCurrentElement({
          ...clickedElement,
          isDragging: true,
          dragOffset: {
            x: pos.x - clickedElement.x,
            y: pos.y - clickedElement.y
          }
        } as any);
        return;
      }
      
      setIsDrawing(false);
      return;
    }

    // Handle drawing tools
    let newElement: WhiteboardElement;
    
    switch (currentTool) {
      case 'rectangle':
        newElement = createShapeElement('rectangle', pos.x, pos.y, currentColor, currentFillColor, strokeWidth);
        break;
      case 'circle':
        newElement = createShapeElement('circle', pos.x, pos.y, currentColor, currentFillColor, strokeWidth);
        break;
      case 'line':
        newElement = createShapeElement('line', pos.x, pos.y, currentColor, currentFillColor, strokeWidth);
        break;
      case 'pen':
      case 'pencil':
        newElement = {
          id: generateUniqueId(),
          type: 'drawing',
          x: pos.x,
          y: pos.y,
          color: currentColor,
          strokeWidth: strokeWidth,
          points: [pos],
          timestamp: Date.now(),
          userId: socket.id,
          isComplete: false
        };
        break;
      case 'text':
        newElement = {
          id: generateUniqueId(),
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: '',
          fontSize: 16,
          fontFamily: 'Arial',
          color: currentColor,
          strokeWidth: strokeWidth,
          timestamp: Date.now(),
          userId: socket.id,
          isComplete: false
        };
        break;
      case 'paintbucket':
        // Paint bucket doesn't create elements, it modifies the canvas directly
        // This will be handled in the Canvas component
        return;
      default:
        return;
    }
    
    setCurrentElement(newElement);
    
    // Add to local state immediately for responsiveness
    setElements(prev => [...prev, newElement]);
    
    // Call callback if provided
    onElementCreated?.(newElement);
    
    // Emit to server
    socket.emit('draw-element', {
      roomId: currentRoom.roomId,
      element: newElement
    });
  }, [socket, currentRoom, getMousePos, setIsDrawing, createShapeElement, generateUniqueId, setCurrentElement, setElements, onElementCreated, onElementDeleted, elements]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>, currentElement: WhiteboardElement | null, currentTool: string) => {
    if (!socket || !currentRoom || !currentElement) return;

    const pos = getMousePos(e);
    
    let updatedElement: WhiteboardElement;
    
    // Handle dragging images
    if (currentTool === 'select' && (currentElement as any).isDragging) {
      const dragOffset = (currentElement as any).dragOffset || { x: 0, y: 0 };
      updatedElement = {
        ...currentElement,
        x: pos.x - dragOffset.x,
        y: pos.y - dragOffset.y
      };
    } else if (currentElement.type === 'shape') {
      updatedElement = updateShapeElement(currentElement, pos.x, pos.y);
    } else if (currentElement.type === 'drawing') {
      updatedElement = {
        ...currentElement,
        points: [...(currentElement.points || []), pos]
      };
    } else {
      return; // Text elements don't update during mouse move
    }
    
    setCurrentElement(updatedElement);
    
    // Update local state immediately for real-time feedback
    setElements(prev => 
      prev.map(el => 
        el.id === currentElement.id ? updatedElement : el
      )
    );
    
    // Call callback if provided
    onElementUpdated?.(updatedElement.id, updatedElement);
    
    // Emit update to server (with debouncing for performance)
    socket.emit('update-element', {
      roomId: currentRoom.roomId,
      elementId: currentElement.id,
      updates: updatedElement
    });
  }, [socket, currentRoom, getMousePos, updateShapeElement, setCurrentElement, setElements, onElementUpdated]);

  const handleMouseUp = useCallback((currentElement: WhiteboardElement | null, currentTool: string) => {
    if (!socket || !currentRoom || !currentElement) return;

    setIsDrawing(false);
    
    // Handle completing drag operation
    if (currentTool === 'select' && (currentElement as any).isDragging) {
      const completedElement = { ...currentElement };
      delete (completedElement as any).isDragging;
      delete (completedElement as any).dragOffset;
      
      setElements(prev => 
        prev.map(el => 
          el.id === currentElement.id ? completedElement : el
        )
      );
      
      onElementCompleted?.(currentElement.id, completedElement);
      
      socket.emit('complete-element', {
        roomId: currentRoom.roomId,
        elementId: currentElement.id,
        element: completedElement
      });
      
      setCurrentElement(null);
      return;
    }
    
    // Validate element before completing
    let isValid = false;
    if (currentElement.type === 'drawing') {
      isValid = currentElement.points && currentElement.points.length >= 1;
    } else if (currentElement.type === 'shape') {
      // For line tool, check if we have valid points
      if (currentElement.shapeType === 'line') {
        isValid = currentElement.points && currentElement.points.length >= 2;
      } else {
        // More lenient validation for other shapes
        isValid = Math.abs(currentElement.width || 0) > 2 && Math.abs(currentElement.height || 0) > 2;
      }
    } else if (currentElement.type === 'text') {
      isValid = currentElement.text && currentElement.text.trim().length > 0;
    } else if (currentElement.type === 'image') {
      isValid = true; // Images are always valid
    }

    if (isValid) {
      const completedElement = { ...currentElement, isComplete: true };
      console.log('Completing element:', completedElement.id, completedElement.type);
      
      // Update local state
      setElements(prev => 
        prev.map(el => 
          el.id === currentElement.id ? completedElement : el
        )
      );
      
      // Call callback if provided
      onElementCompleted?.(currentElement.id, completedElement);
      
      // Emit completion to server
      socket.emit('complete-element', {
        roomId: currentRoom.roomId,
        elementId: currentElement.id,
        element: completedElement
      });
    } else {
      console.log('Deleting invalid element:', currentElement.id);
      
      // Remove from local state
      setElements(prev => prev.filter(el => el.id !== currentElement.id));
      
      // Call callback if provided
      onElementDeleted?.(currentElement.id);
      
      // Emit deletion to server
      socket.emit('delete-element', {
        roomId: currentRoom.roomId,
        elementId: currentElement.id
      });
    }

    setCurrentElement(null);
  }, [socket, currentRoom, setCurrentElement, setIsDrawing, setElements, onElementCompleted, onElementDeleted]);

  // Socket event listeners - REMOVED undo/redo management
  useEffect(() => {
    if (!socket) return;

    // Listen for canvas cleared event
    const handleCanvasCleared = (data: { roomId: string }) => {
      console.log('Canvas cleared for room:', data.roomId);
      
      // Clear all elements from local state
      setElements([]);
      
      // Clear any active drawing states
      setCurrentElement(null);
      setIsDrawing(false);
      
      // Clear canvas context if you have direct canvas manipulation
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      // Show success message to user
      showNotification('Canvas cleared successfully', 'success');
    };

    // Updated element-drawn listener to handle shapeType
    const handleElementDrawn = (data: { element: WhiteboardElement }) => {
      console.log('Element drawn:', data.element.id, 'type:', data.element.type, 'shapeType:', data.element.shapeType);
      
      setElements(prevElements => {
        // Avoid duplicates
        const exists = prevElements.some(el => el.id === data.element.id);
        if (!exists) {
          return [...prevElements, data.element];
        }
        return prevElements;
      });
    };

    // Updated element-updated listener to handle shapeType  
    const handleElementUpdated = (data: { elementId: string; updates: Partial<WhiteboardElement> | WhiteboardElement }) => {
      console.log('Element updated:', data.elementId, 'type:', (data.updates as any)?.type, 'shapeType:', (data.updates as any)?.shapeType);
      
      setElements(prevElements => 
        prevElements.map(element => 
          element.id === data.elementId 
            ? { ...element, ...data.updates }
            : element
        )
      );
    };

    // Updated element-completed listener to handle shapeType
    const handleElementCompleted = (data: { element: WhiteboardElement }) => {
      console.log('Element completed:', data.element.id, 'type:', data.element.type, 'shapeType:', data.element.shapeType);
      
      setElements(prevElements => 
        prevElements.map(element => 
          element.id === data.element.id 
            ? data.element  // Replace with complete element data
            : element
        )
      );
    };

    // Handle element deletion from other clients
    const handleElementDeleted = (data: { elementId: string }) => {
      console.log('Element deleted:', data.elementId);
      
      setElements(prevElements => 
        prevElements.filter(element => element.id !== data.elementId)
      );
    };

    // Handle text updates from other clients
    const handleTextUpdated = (data: { element: WhiteboardElement }) => {
      console.log('Text updated from another user:', data.element.id);
      
      setElements(prevElements => 
        prevElements.map(element => 
          element.id === data.element.id 
            ? data.element
            : element
        )
      );
    };

    // Add event listeners - REMOVED undo/redo listeners
    socket.on('canvas-cleared', handleCanvasCleared);
    socket.on('element-drawn', handleElementDrawn);
    socket.on('element-updated', handleElementUpdated);
    socket.on('element-completed', handleElementCompleted);
    socket.on('element-deleted', handleElementDeleted);
    socket.on('text-updated', handleTextUpdated);

    // Cleanup - REMOVED undo/redo cleanup
    return () => {
      socket.off('canvas-cleared', handleCanvasCleared);
      socket.off('element-drawn', handleElementDrawn);
      socket.off('element-updated', handleElementUpdated);
      socket.off('element-completed', handleElementCompleted);
      socket.off('element-deleted', handleElementDeleted);
      socket.off('text-updated', handleTextUpdated);
    };
  }, [socket, setElements, setCurrentElement, setIsDrawing, canvasRef, showNotification]);

  return {
    clearCanvas,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    createShapeElement,
    updateShapeElement
  };
};