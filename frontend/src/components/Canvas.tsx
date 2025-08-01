import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WhiteboardElement } from '../types/whiteboard';
import { useSocketEvents } from '../hooks/useSocketEvents';

interface CanvasProps {
  elements: WhiteboardElement[];
  selectedTool: string;
  color: string;
  fillColor: string; // New: fill color prop
  strokeWidth: number;
  onElementCreated: (element: WhiteboardElement) => void;
  onElementUpdated: (elementId: string, updates: Partial<WhiteboardElement> | WhiteboardElement) => void;
  onElementDeleted: (elementId: string) => void;
  onElementCompleted: (elementId: string, completedElement: WhiteboardElement) => void;
  onCursorMove: (cursor: { x: number; y: number }) => void;
  onTextInput: (element: WhiteboardElement) => void;
  socket?: any;
  currentRoom?: { roomId: string } | null;
  onClearCanvas?: () => void;
  users?: Array<{ id: string; name: string; cursor?: { x: number; y: number } }>; // New: users for cursor rendering
  currentUserId?: string; // New: current user ID to avoid rendering own cursor
}

const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedTool,
  color,
  fillColor,
  strokeWidth,
  onElementCreated,
  onElementUpdated,
  onElementDeleted,
  onElementCompleted,
  onCursorMove,
  onTextInput,
  socket,
  currentRoom,
  onClearCanvas,
  users = [],
  currentUserId
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ 
    x: number; 
    y: number; 
    elementId: string; 
    value: string;
  } | null>(null);
  
  // Improved throttling for smooth drawing
  const lastUpdateTime = useRef<number>(0);
  const updateThrottleMs = 8; // ~120fps for smoother drawing
  const animationFrameId = useRef<number | null>(null);
  const pendingUpdates = useRef<Map<string, WhiteboardElement>>(new Map());
  
  // Cursor timeout for stopping cursor updates
  const cursorTimeoutRef = useRef<number | null>(null);
  const cursorStopDelay = 1000; // 1 second delay before stopping cursor

  // Socket events integration with proper callbacks
  const {
    clearCanvas: socketClearCanvas,
    handleMouseDown: socketHandleMouseDown,
    handleMouseMove: socketHandleMouseMove,
    handleMouseUp: socketHandleMouseUp
  } = useSocketEvents({
    socket,
    currentRoom,
    elements,
    setElements: () => {}, // We'll handle this through props
    setUndoStack: () => {}, // We'll handle this through props
    setRedoStack: () => {}, // We'll handle this through props
    setCurrentElement,
    setIsDrawing,
    canvasRef,
    onElementCreated,
    onElementUpdated,
    onElementDeleted,
    onElementCompleted,
    selectedTool,
    color,
    fillColor,
    strokeWidth
  });

  // Generate unique IDs
  const generateId = useCallback(() => {
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
  }, []);

  // Handle image paste
  const handlePaste = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target?.result as string;
            if (imageData) {
              const elementId = generateId();
              const timestamp = Date.now();
              
              const imageElement: WhiteboardElement = {
                id: elementId,
                type: 'image',
                x: 100, // Default position
                y: 100,
                width: 200, // Default size
                height: 200,
                color: '#000000',
                strokeWidth: 1,
                imageData: imageData,
                timestamp,
                userId: 'current-user',
                isComplete: true,
              };
              
              onElementCreated(imageElement);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [generateId, onElementCreated]);

  // Add paste event listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  // Draw single element on canvas
  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
    if (!element || !element.id) return;

    ctx.save();
    
    // Set common properties
    ctx.strokeStyle = element.color || '#000000';
    ctx.fillStyle = element.fillColor || element.color || '#000000';
    ctx.lineWidth = element.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    try {
      switch (element.type) {
        case 'drawing':
          if (element.points && element.points.length > 0) {
            if (element.points.length === 1) {
              // Draw a dot for single point
              ctx.beginPath();
              ctx.arc(element.points[0].x, element.points[0].y, (element.strokeWidth || 2) / 2, 0, 2 * Math.PI);
              ctx.fill();
            } else {
              // Draw smooth curve for multiple points with improved smoothing
              ctx.beginPath();
              ctx.moveTo(element.points[0].x, element.points[0].y);
              
              if (element.points.length === 2) {
                ctx.lineTo(element.points[1].x, element.points[1].y);
              } else {
                // Use quadratic curves for smoother lines with tension control
                for (let i = 1; i < element.points.length - 1; i++) {
                  const current = element.points[i];
                  const next = element.points[i + 1];
                  const xMid = (current.x + next.x) / 2;
                  const yMid = (current.y + next.y) / 2;
                  ctx.quadraticCurveTo(current.x, current.y, xMid, yMid);
                }
                // Draw final segment
                const lastPoint = element.points[element.points.length - 1];
                ctx.lineTo(lastPoint.x, lastPoint.y);
              }
              ctx.stroke();
            }
          }
          break;

        case 'text':
          if (element.text && element.text.trim()) {
            ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
            ctx.textBaseline = 'top';
            ctx.fillStyle = element.color || '#000000';
            ctx.fillText(element.text, element.x, element.y);
          }
          break;

        case 'shape':
          if (element.width !== undefined && element.height !== undefined && 
              Math.abs(element.width) > 0 && Math.abs(element.height) > 0) {
            ctx.beginPath();
            
            console.log('Drawing shape:', element.shapeType, 'with dimensions:', element.width, element.height);
            
            if (element.shapeType === 'rectangle' || !element.shapeType) {
              ctx.rect(element.x, element.y, element.width, element.height);
            } else if (element.shapeType === 'circle') {
              const centerX = element.x + element.width / 2;
              const centerY = element.y + element.height / 2;
              const radius = Math.min(Math.abs(element.width), Math.abs(element.height)) / 2;
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            } else if (element.shapeType === 'line') {
              // Handle line with points
              if (element.points && element.points.length >= 2) {
                ctx.moveTo(element.points[0].x, element.points[0].y);
                ctx.lineTo(element.points[1].x, element.points[1].y);
              } else {
                // Fallback to width/height for backward compatibility
                ctx.moveTo(element.x, element.y);
                ctx.lineTo(element.x + element.width, element.y + element.height);
              }
            }
            
            // Fill shape if it has fill color and is not a line
            if (element.fillColor && element.shapeType !== 'line') {
              ctx.fill();
            }
            
            // Always stroke for outline
            ctx.stroke();
          } else if (element.shapeType === 'line' && element.points && element.points.length >= 2) {
            // Handle line with only points (no width/height)
            ctx.beginPath();
            ctx.moveTo(element.points[0].x, element.points[0].y);
            ctx.lineTo(element.points[1].x, element.points[1].y);
            ctx.stroke();
          }
          break;

        case 'image':
          if (element.imageData && element.width && element.height) {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, element.x, element.y, element.width, element.height);
            };
            img.src = element.imageData;
          }
          break;
      }
    } catch (error) {
      console.error('Error drawing element:', element.id, error);
    }
    
    ctx.restore();
  }, []);

  // Draw remote cursors
  const drawCursors = useCallback((ctx: CanvasRenderingContext2D) => {
    users.forEach(user => {
      if (user.cursor && user.id !== currentUserId) {
        const { x, y } = user.cursor;
        
        // Draw cursor circle
        ctx.save();
        ctx.fillStyle = '#FF0000';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw username
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(user.name, x, y - 15);
        ctx.restore();
      }
    });
  }, [users, currentUserId]);

  // Redraw entire canvas - improved with better performance
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Cancel any pending animation frame
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    animationFrameId.current = requestAnimationFrame(() => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw all elements
      elements.forEach(element => {
        drawElement(ctx, element);
      });

      // Draw current element being created on top
      if (currentElement) {
        drawElement(ctx, currentElement);
      }

      // Draw remote cursors on top
      drawCursors(ctx);
    });
  }, [elements, currentElement, drawElement, drawCursors]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set display size
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      
      // Set actual size in memory (scaled for high DPI)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale context for high DPI
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        // Set canvas logical size
        ctx.canvas.style.width = rect.width + 'px';
        ctx.canvas.style.height = rect.height + 'px';
      }
      
      // Redraw after resize
      redrawCanvas();
    };

    // Initial resize
    setTimeout(resizeCanvas, 0);
    
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(resizeCanvas, 0);
    });
    resizeObserver.observe(container);
    
    return () => {
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [redrawCanvas]);

  // Redraw when elements change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Double click handler for text
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'text') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getMousePos(e);
    const elementId = generateId();
    const timestamp = Date.now();

    const element: WhiteboardElement = {
      id: elementId,
      type: 'text',
      x: pos.x,
      y: pos.y,
      text: '',
      color,
      strokeWidth,
      fontSize: 16,
      fontFamily: 'Arial',
      timestamp,
      userId: 'current-user',
      isComplete: false,
    };

    setTextInput({ 
      x: pos.x, 
      y: pos.y - 5, // Adjust for better visual alignment
      elementId, 
      value: '' 
    });
    
    console.log('Text element created:', elementId);
    onElementCreated(element);
  }, [selectedTool, getMousePos, generateId, color, strokeWidth, onElementCreated]);

  // Enhanced flood fill algorithm with better color tolerance
  const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get image data from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Convert fill color to RGBA
    const fillColorRGB = hexToRgb(fillColor);
    if (!fillColorRGB) return;

    // Get target color at start position
    const startPos = (startY * width + startX) * 4;
    const targetR = data[startPos];
    const targetG = data[startPos + 1];
    const targetB = data[startPos + 2];
    const targetA = data[startPos + 3];

    // Don't fill if target color is the same as fill color
    if (targetR === fillColorRGB.r && targetG === fillColorRGB.g && 
        targetB === fillColorRGB.b && targetA === fillColorRGB.a) {
      return;
    }

    // Enhanced color tolerance for better flood fill
    const tolerance = 50; // Increased tolerance for better matching

    // Check if colors are similar using improved algorithm
    const isSimilarColor = (r1: number, g1: number, b1: number, a1: number,
                           r2: number, g2: number, b2: number, a2: number) => {
      // Use Euclidean distance for better color matching
      const distance = Math.sqrt(
        Math.pow(r1 - r2, 2) + 
        Math.pow(g1 - g2, 2) + 
        Math.pow(b1 - b2, 2) + 
        Math.pow(a1 - a2, 2)
      );
      return distance <= tolerance;
    };

    // Queue-based flood fill for better performance
    const queue: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const pos = (y * width + x) * 4;
      const r = data[pos];
      const g = data[pos + 1];
      const b = data[pos + 2];
      const a = data[pos + 3];

      if (!isSimilarColor(r, g, b, a, targetR, targetG, targetB, targetA)) continue;

      // Fill this pixel
      data[pos] = fillColorRGB.r;
      data[pos + 1] = fillColorRGB.g;
      data[pos + 2] = fillColorRGB.b;
      data[pos + 3] = fillColorRGB.a;

      // Add neighbors to queue (4-directional flood fill)
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Put image data back to canvas
    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Helper function to convert hex color to RGB
  const hexToRgb = useCallback((hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 255
    } : null;
  }, []);

  // Mouse down handler with improved drawing reliability
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getMousePos(e);
    setStartPoint(pos);

    // Close text input if clicking elsewhere
    if (textInput) {
      handleTextSubmit();
    }

    if (selectedTool === 'text') {
      // Text tool uses double-click, ignore single click
      return;
    }

    // Handle paint bucket tool
    if (selectedTool === 'paintbucket') {
      console.log('Paint bucket clicked at:', pos);
      floodFill(pos.x, pos.y, fillColor);
      onCursorMove(pos);
      return;
    }

    // Use socket events if available
    if (socket && currentRoom) {
      socketHandleMouseDown(e, selectedTool, color, fillColor, strokeWidth);
      onCursorMove(pos);
      return;
    }

    // Fallback to original implementation for non-socket scenarios
    setIsDrawing(true);
    const elementId = generateId();
    const timestamp = Date.now();

    if (selectedTool === 'pen' || selectedTool === 'pencil') {
      const element: WhiteboardElement = {
        id: elementId,
        type: 'drawing',
        x: pos.x,
        y: pos.y,
        points: [pos],
        color,
        strokeWidth,
        timestamp,
        userId: 'current-user',
        isComplete: false,
      };
      setCurrentElement(element);
      onElementCreated(element);
      
    } else if (selectedTool === 'eraser') {
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
        }
        return false;
      });

      elementsToDelete.forEach(element => {
        console.log('Deleting element:', element.id);
        onElementDeleted(element.id);
      });
      
      setIsDrawing(false);
      return;
      
    } else if (['rectangle', 'circle', 'line'].includes(selectedTool)) {
      const element: WhiteboardElement = {
        id: elementId,
        type: 'shape',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color,
        fillColor, // Add fill color
        strokeWidth,
        shapeType: selectedTool as 'rectangle' | 'circle' | 'line',
        timestamp,
        userId: 'current-user',
        isComplete: false,
      };
      
      // For line tool, initialize with points
      if (selectedTool === 'line') {
        element.points = [
          { x: pos.x, y: pos.y },
          { x: pos.x, y: pos.y } // Start and end at same point initially
        ];
      }
      
      setCurrentElement(element);
      onElementCreated(element);
    }

    onCursorMove(pos);
  }, [selectedTool, color, fillColor, strokeWidth, getMousePos, generateId, onElementCreated, onElementDeleted, onCursorMove, elements, textInput, socket, currentRoom, socketHandleMouseDown, floodFill]);

  // Mouse move handler with improved throttling and reliability
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    onCursorMove(pos);

    if (!isDrawing || !currentElement || !startPoint) return;

    // Use socket events if available
    if (socket && currentRoom) {
      socketHandleMouseMove(e, currentElement);
      return;
    }

    // Improved throttling for smoother drawing
    const now = Date.now();
    const shouldUpdate = now - lastUpdateTime.current > updateThrottleMs;

    if (currentElement.type === 'drawing') {
      const newPoints = [...(currentElement.points || []), pos];
      const updatedElement = { ...currentElement, points: newPoints };
      setCurrentElement(updatedElement);

      // Always update locally for immediate feedback
      if (shouldUpdate) {
        onElementUpdated(updatedElement.id, { points: newPoints });
        lastUpdateTime.current = now;
      }
      
    } else if (currentElement.type === 'shape') {
      const width = pos.x - startPoint.x;
      const height = pos.y - startPoint.y;
      
      // Calculate proper position and dimensions for shapes
      const x = width < 0 ? pos.x : startPoint.x;
      const y = height < 0 ? pos.y : startPoint.y;
      const w = Math.abs(width);
      const h = Math.abs(height);
      
      const updatedElement = { 
        ...currentElement, 
        x,
        y,
        width: w,
        height: h,
        // Ensure shapeType is preserved
        shapeType: currentElement.shapeType
      };
      
      // For line tool, update points instead of width/height
      if (currentElement.shapeType === 'line') {
        updatedElement.points = [
          { x: startPoint.x, y: startPoint.y }, // Start point
          { x: pos.x, y: pos.y } // End point
        ];
      }
      
      setCurrentElement(updatedElement);

      if (shouldUpdate) {
        if (currentElement.shapeType === 'line') {
          onElementUpdated(updatedElement.id, { 
            x, 
            y, 
            points: updatedElement.points,
            shapeType: currentElement.shapeType 
          });
        } else {
          onElementUpdated(updatedElement.id, { x, y, width: w, height: h, shapeType: currentElement.shapeType });
        }
        lastUpdateTime.current = now;
      }
    }
  }, [isDrawing, currentElement, startPoint, getMousePos, onCursorMove, onElementUpdated, socket, currentRoom, socketHandleMouseMove]);

  // Mouse up handler - FIXED: Now properly completes lines and ensures final strokes are saved
  const handleMouseUp = useCallback((e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return;

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Use socket events if available
    if (socket && currentRoom) {
      socketHandleMouseUp(currentElement);
      return;
    }

    // Fallback to original implementation for non-socket scenarios
    setIsDrawing(false);
    
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
    }

    if (isValid) {
      const completedElement = { ...currentElement, isComplete: true };
      console.log('Completing element:', completedElement.id, completedElement.type);
      onElementCompleted(currentElement.id, completedElement);
    } else {
      console.log('Deleting invalid element:', currentElement.id);
      onElementDeleted(currentElement.id);
    }

    setCurrentElement(null);
    setStartPoint(null);
  }, [isDrawing, currentElement, onElementCompleted, onElementDeleted, socket, currentRoom, socketHandleMouseUp]);

  // Text input handlers
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!textInput) return;
    
    const newValue = e.target.value;
    setTextInput(prev => prev ? { ...prev, value: newValue } : null);
    
    // Update the element with new text
    const updatedElement: Partial<WhiteboardElement> = { text: newValue };
    onElementUpdated(textInput.elementId, updatedElement);
  }, [textInput, onElementUpdated]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput) return;
    
    const element = elements.find(el => el.id === textInput.elementId);
    if (element && textInput.value.trim()) {
      const completedElement = { ...element, text: textInput.value.trim(), isComplete: true };
      console.log('Completing text element:', completedElement.id, completedElement.text);
      onElementCompleted(textInput.elementId, completedElement);
      onTextInput(completedElement);
    } else {
      console.log('Deleting empty text element:', textInput.elementId);
      onElementDeleted(textInput.elementId);
    }
    setTextInput(null);
  }, [textInput, elements, onElementCompleted, onElementDeleted, onTextInput]);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      console.log('Canceling text input');
      if (textInput) {
        onElementDeleted(textInput.elementId);
      }
      setTextInput(null);
    }
  }, [handleTextSubmit, textInput, onElementDeleted]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{
          cursor: selectedTool === 'text' ? 'text' : 
                 selectedTool === 'eraser' ? 'grab' :
                 selectedTool === 'paintbucket' ? 'crosshair' : 'crosshair'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Text Input Overlay */}
      {textInput && (
        <div className="absolute z-10" style={{ left: textInput.x, top: textInput.y }}>
          <input
            type="text"
            autoFocus
            value={textInput.value}
            className="bg-transparent border-none outline-none"
            style={{
              fontSize: '16px',
              fontFamily: 'Arial',
              color: color,
              minWidth: '2px',
              width: `${Math.max(textInput.value.length * 8 + 10, 50)}px`,
            }}
            placeholder="Type text..."
            onChange={handleTextChange}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextSubmit}
          />
          <div 
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              fontSize: '16px',
              fontFamily: 'Arial',
              color: color,
              borderBottom: '1px solid ' + color,
              width: `${Math.max(textInput.value.length * 8 + 10, 50)}px`,
              height: '20px',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Canvas;