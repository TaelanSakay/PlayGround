import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WhiteboardElement } from '../types/whiteboard';

interface CanvasProps {
  elements: WhiteboardElement[];
  selectedTool: string;
  color: string;
  strokeWidth: number;
  onElementCreated: (element: WhiteboardElement) => void;
  onElementUpdated: (elementId: string, updates: Partial<WhiteboardElement>) => void;
  onElementDeleted: (elementId: string) => void;
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
  onCursorMove,
  onTextInput,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; elementId: string } | null>(null);

  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = element.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'drawing':
        if (element.points && element.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          element.points.forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        break;

      case 'text':
        if (element.text) {
          ctx.font = `${element.fontSize || 16}px ${element.fontFamily || 'Arial'}`;
          ctx.fillText(element.text, element.x, element.y);
        }
        break;

      case 'shape':
        if (element.width && element.height) {
          if (selectedTool === 'rectangle') {
            ctx.strokeRect(element.x, element.y, element.width, element.height);
          } else if (selectedTool === 'circle') {
            ctx.beginPath();
            ctx.arc(
              element.x + element.width / 2,
              element.y + element.height / 2,
              Math.min(element.width, element.height) / 2,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          } else if (selectedTool === 'line') {
            ctx.beginPath();
            ctx.moveTo(element.x, element.y);
            ctx.lineTo(element.x + (element.width || 0), element.y + (element.height || 0));
            ctx.stroke();
          }
        }
        break;
    }
  }, [selectedTool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    elements.forEach((element) => {
      drawElement(ctx, element);
    });
  }, [elements, drawElement]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    setIsDrawing(true);

    if (selectedTool === 'text') {
      const elementId = `text-${Date.now()}`;
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
        timestamp: Date.now(),
        userId: 'current-user',
      };
      setCurrentElement(element);
      setTextInput({ x: pos.x, y: pos.y, elementId });
      onElementCreated(element);
    } else if (selectedTool === 'pen' || selectedTool === 'eraser') {
      const elementId = `drawing-${Date.now()}`;
      const element: WhiteboardElement = {
        id: elementId,
        type: 'drawing',
        x: pos.x,
        y: pos.y,
        points: [pos],
        color: selectedTool === 'eraser' ? '#FFFFFF' : color,
        strokeWidth: selectedTool === 'eraser' ? strokeWidth * 2 : strokeWidth,
        timestamp: Date.now(),
        userId: 'current-user',
      };
      setCurrentElement(element);
      onElementCreated(element);
    } else if (['rectangle', 'circle', 'line'].includes(selectedTool)) {
      const elementId = `shape-${Date.now()}`;
      const element: WhiteboardElement = {
        id: elementId,
        type: 'shape',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        color,
        strokeWidth,
        timestamp: Date.now(),
        userId: 'current-user',
      };
      setCurrentElement(element);
      onElementCreated(element);
    }

    onCursorMove(pos);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    onCursorMove(pos);

    if (!isDrawing || !currentElement) return;

    if (currentElement.type === 'drawing' && currentElement.points) {
      const newPoints = [...currentElement.points, pos];
      const updatedElement = { ...currentElement, points: newPoints };
      setCurrentElement(updatedElement);
      onElementUpdated(currentElement.id, { points: newPoints });
    } else if (currentElement.type === 'shape') {
      const width = pos.x - currentElement.x;
      const height = pos.y - currentElement.y;
      const updatedElement = { ...currentElement, width, height };
      setCurrentElement(updatedElement);
      onElementUpdated(currentElement.id, { width, height });
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setCurrentElement(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!textInput) return;

    if (e.key === 'Enter') {
      // Finish text input
      setTextInput(null);
    } else if (e.key === 'Escape') {
      // Cancel text input
      onElementDeleted(textInput.elementId);
      setTextInput(null);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!textInput) return;

    const newText = e.target.value;
    onElementUpdated(textInput.elementId, { text: newText });
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={window.innerWidth - 400} // Adjust for toolbar and user list
        height={window.innerHeight - 100} // Adjust for header
        className="border border-gray-300 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      />
      
      {/* Text Input Overlay */}
      {textInput && (
        <input
          type="text"
          autoFocus
          className="absolute border-none outline-none bg-transparent text-black"
          style={{
            left: textInput.x,
            top: textInput.y - 20,
            fontSize: '16px',
            fontFamily: 'Arial',
            color: color,
          }}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTextInput(null)}
        />
      )}
    </div>
  );
};

export default Canvas; 