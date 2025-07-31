import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WhiteboardElement } from '../types/whiteboard';

interface CanvasProps {
  elements: WhiteboardElement[];
  selectedTool: string;
  color: string;
  strokeWidth: number;
  onElementCreated: (element: WhiteboardElement) => void;
  onElementUpdated: (elementId: string, updates: Partial<WhiteboardElement> | WhiteboardElement) => void;
  onElementDeleted: (elementId: string) => void;
  onElementCompleted: (elementId: string, completedElement: WhiteboardElement) => void;
  onCursorMove: (cursor: { x: number; y: number }) => void;
  onTextInput: (element: WhiteboardElement) => void;
}

const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedTool,
  color,
  strokeWidth,
  onElementCreated,
  onElementUpdated,
  onElementDeleted,
  onElementCompleted,
  onCursorMove,
  onTextInput
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; elementId: string } | null>(null);
  
  // Track last update time to throttle updates
  const lastUpdateTime = useRef<number>(0);
  const updateThrottleMs = 16; // ~60fps

  // Generate unique IDs
  const generateId = useCallback(() => {
    return `${selectedTool}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, [selectedTool]);

  // Get mouse position relative to canvas
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Draw single element on canvas
  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
    ctx.save();
    
    // Set common properties
    ctx.strokeStyle = element.color || '#000000';
    ctx.fillStyle = element.color || '#000000';
    ctx.lineWidth = element.strokeWidth || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'drawing':
        if (element.points && element.points.length > 0) {
          if (element.points.length === 1) {
            // Draw a dot for single point
            ctx.beginPath();
            ctx.arc(element.points[0].x, element.points[0].y, element.strokeWidth / 2, 0, 2 * Math.PI);
            ctx.fill();
          } else {
            // Draw line for multiple points
            ctx.beginPath();
            ctx.moveTo(element.points[0].x, element.points[0].y);
            for (let i = 1; i < element.points.length; i++) {
              ctx.lineTo(element.points[i].x, element.points[i].y);
            }
            ctx.stroke();
          }
        }
        break;

      case 'text':
        if (element.text) {
          ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
          ctx.fillText(element.text, element.x, element.y);
        }
        break;

      case 'shape':
        if (element.width !== undefined && element.height !== undefined) {
          ctx.beginPath();
          if (element.shapeType === 'rectangle' || !element.shapeType) {
            ctx.rect(element.x, element.y, element.width, element.height);
          } else if (element.shapeType === 'circle') {
            const centerX = element.x + element.width / 2;
            const centerY = element.y + element.height / 2;
            const radius = Math.min(Math.abs(element.width), Math.abs(element.height)) / 2;
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
          } else if (element.shapeType === 'line') {
            ctx.moveTo(element.x, element.y);
            ctx.lineTo(element.x + element.width, element.y + element.height);
          }
          ctx.stroke();
        }
        break;
    }
    
    ctx.restore();
  }, []);

  // Redraw entire canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    elements.forEach(element => {
      drawElement(ctx, element);
    });

    // Draw current element being created
    if (currentElement) {
      drawElement(ctx, currentElement);
    }
  }, [elements, currentElement, drawElement]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Redraw after resize
      requestAnimationFrame(redrawCanvas);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [redrawCanvas]);

  // Redraw when elements change
  useEffect(() => {
    requestAnimationFrame(redrawCanvas);
  }, [redrawCanvas]);

  // Mouse down handler
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    
    const pos = getMousePos(e);
    setStartPoint(pos);
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
          // Check if any point is within eraser radius
          return element.points.some(point => {
            const distance = Math.sqrt(
              Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2)
            );
            return distance <= strokeWidth * 2;
          });
        } else if (element.type === 'shape') {
          // Check if click is within shape bounds
          const withinX = pos.x >= element.x && pos.x <= element.x + (element.width || 0);
          const withinY = pos.y >= element.y && pos.y <= element.y + (element.height || 0);
          return withinX && withinY;
        } else if (element.type === 'text') {
          // Check if click is near text
          const distance = Math.sqrt(
            Math.pow(element.x - pos.x, 2) + Math.pow(element.y - pos.y, 2)
          );
          return distance <= 50; // 50px radius for text
        }
        return false;
      });

      console.log('Elements to delete:', elementsToDelete);
      // Delete found elements
      elementsToDelete.forEach(element => {
        console.log('Deleting element:', element.id);
        onElementDeleted(element.id);
      });
      
      // Don't create a drawing element for eraser
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
        strokeWidth,
        shapeType: selectedTool as 'rectangle' | 'circle' | 'line',
        timestamp,
        userId: 'current-user',
        isComplete: false,
      };
      setCurrentElement(element);
      onElementCreated(element);
    } else if (selectedTool === 'text') {
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
      setCurrentElement(element);
             setTextInput({ x: pos.x, y: pos.y, elementId });
       console.log('Text input created at:', pos);
      onElementCreated(element);
      return; // Don't start drawing for text
    }

    onCursorMove(pos);
  }, [selectedTool, color, strokeWidth, getMousePos, generateId, onElementCreated, onCursorMove]);

  // Mouse move handler with throttling
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    onCursorMove(pos);

    if (!isDrawing || !currentElement || !startPoint) return;

    const now = Date.now();
    const shouldUpdate = now - lastUpdateTime.current > updateThrottleMs;

    if (currentElement.type === 'drawing') {
      const newPoints = [...(currentElement.points || []), pos];
      const updatedElement = { ...currentElement, points: newPoints };
      setCurrentElement(updatedElement);

      // Throttle server updates but always update locally
      if (shouldUpdate) {
        onElementUpdated(updatedElement.id, updatedElement);
        lastUpdateTime.current = now;
      }
    } else if (currentElement.type === 'shape') {
      const width = pos.x - startPoint.x;
      const height = pos.y - startPoint.y;
      const updatedElement = { 
        ...currentElement, 
        x: width < 0 ? pos.x : startPoint.x,
        y: height < 0 ? pos.y : startPoint.y,
        width: Math.abs(width),
        height: Math.abs(height),
      };
      setCurrentElement(updatedElement);

      if (shouldUpdate) {
        onElementUpdated(updatedElement.id, updatedElement);
        lastUpdateTime.current = now;
      }
    }
  }, [isDrawing, currentElement, startPoint, getMousePos, onCursorMove, onElementUpdated]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentElement) return;

    setIsDrawing(false);
    
    // Validate element before completing
    let isValid = false;
    if (currentElement.type === 'drawing') {
      isValid = currentElement.points && currentElement.points.length >= 1;
    } else if (currentElement.type === 'shape') {
      isValid = Math.abs(currentElement.width || 0) > 0 && Math.abs(currentElement.height || 0) > 0;
      console.log('Shape validation:', { width: currentElement.width, height: currentElement.height, isValid });
    }

    if (isValid) {
      const completedElement = { ...currentElement, isComplete: true };
      onElementCompleted(currentElement.id, completedElement);
    } else {
      // Delete invalid element
      onElementDeleted(currentElement.id);
    }

    setCurrentElement(null);
    setStartPoint(null);
  }, [isDrawing, currentElement, onElementCompleted, onElementDeleted]);

  // Text input handlers
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!textInput) return;
    
    const newText = e.target.value;
    onElementUpdated(textInput.elementId, { text: newText });
  }, [textInput, onElementUpdated]);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!textInput) return;

    if (e.key === 'Enter') {
      const element = elements.find(el => el.id === textInput.elementId);
      if (element?.text?.trim()) {
        const completedElement = { ...element, isComplete: true };
        onElementCompleted(textInput.elementId, completedElement);
      } else {
        onElementDeleted(textInput.elementId);
      }
      setTextInput(null);
    } else if (e.key === 'Escape') {
      onElementDeleted(textInput.elementId);
      setTextInput(null);
    }
  }, [textInput, elements, onElementCompleted, onElementDeleted]);

  const handleTextBlur = useCallback(() => {
    if (!textInput) return;
    
    const element = elements.find(el => el.id === textInput.elementId);
    if (element?.text?.trim()) {
      const completedElement = { ...element, isComplete: true };
      onElementCompleted(textInput.elementId, completedElement);
    } else {
      onElementDeleted(textInput.elementId);
    }
    setTextInput(null);
  }, [textInput, elements, onElementCompleted, onElementDeleted]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{
          cursor: selectedTool === 'text' ? 'text' : 
                 selectedTool === 'eraser' ? 'grab' : 'crosshair'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

             {/* Text Input Overlay */}
       {textInput && (
         <input
           type="text"
           autoFocus
           className="absolute bg-white border border-gray-300 rounded px-2 py-1 outline-none shadow-sm"
           style={{
             left: textInput.x,
             top: textInput.y,
             fontSize: '16px',
             fontFamily: 'Arial',
             color: color,
             minWidth: '100px',
             zIndex: 1000,
           }}
           placeholder="Type text..."
           onChange={handleTextChange}
           onKeyDown={handleTextKeyDown}
           onBlur={handleTextBlur}
         />
       )}
       {textInput && (
         <div 
           className="absolute bg-blue-100 border border-blue-300 rounded px-2 py-1 text-xs"
           style={{
             left: textInput.x,
             top: textInput.y - 20,
             zIndex: 999,
           }}
         >
           Text input active
         </div>
       )}
    </div>
  );
};

export default Canvas;