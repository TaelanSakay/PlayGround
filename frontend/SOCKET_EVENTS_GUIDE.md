# Enhanced Socket Events Integration Guide

This guide explains the enhanced socket event listeners and drawing handlers that have been integrated into the whiteboard application.

## Overview

The enhanced socket events provide:
- Real-time collaborative drawing with shape support (rectangle, circle, line)
- Canvas clearing functionality
- Improved element completion handling
- Better error handling and user feedback
- Notification system for user actions

## Key Features

### 1. Canvas Clearing
```typescript
// Function to emit clear-canvas event
const clearCanvas = () => {
  if (!socket || !currentRoom) {
    console.error('Socket or room not available');
    return;
  }
  
  // Emit clear-canvas event to server
  socket.emit('clear-canvas', { roomId: currentRoom.roomId });
  
  // Show loading state
  showNotification('Clearing canvas...', 'info');
};
```

### 2. Shape Drawing Support
The enhanced system supports three shape types:
- **Rectangle**: Drawn by clicking and dragging
- **Circle**: Drawn by clicking and dragging (creates an ellipse)
- **Line**: Drawn by clicking start point and dragging to end point

```typescript
// Create shape element with proper shapeType
const createShapeElement = (shapeType, startX, startY, color, strokeWidth) => {
  const elementId = generateUniqueId();
  
  const baseElement = {
    id: elementId,
    type: 'shape',
    shapeType: shapeType, // 'rectangle', 'circle', or 'line'
    x: startX,
    y: startY,
    color: color,
    strokeWidth: strokeWidth,
    width: 0,
    height: 0,
    timestamp: Date.now(),
    userId: socket.id,
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
};
```

### 3. Enhanced Mouse Event Handlers

#### Mouse Down Handler
```typescript
const handleMouseDown = (e, currentTool, currentColor, strokeWidth) => {
  if (!socket || !currentRoom) return;

  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  setIsDrawing(true);
  
  let newElement;
  
  switch (currentTool) {
    case 'rectangle':
      newElement = createShapeElement('rectangle', x, y, currentColor, strokeWidth);
      break;
    case 'circle':
      newElement = createShapeElement('circle', x, y, currentColor, strokeWidth);
      break;
    case 'line':
      newElement = createShapeElement('line', x, y, currentColor, strokeWidth);
      break;
    case 'pen':
      newElement = {
        id: generateUniqueId(),
        type: 'drawing',
        x: x,
        y: y,
        color: currentColor,
        strokeWidth: strokeWidth,
        points: [{ x, y }],
        timestamp: Date.now(),
        userId: socket.id,
        isComplete: false
      };
      break;
    case 'text':
      newElement = {
        id: generateUniqueId(),
        type: 'text',
        x: x,
        y: y,
        text: '',
        fontSize: 16,
        fontFamily: 'Arial',
        color: currentColor,
        timestamp: Date.now(),
        userId: socket.id,
        isComplete: false
      };
      break;
    default:
      return;
  }
  
  setCurrentElement(newElement);
  
  // Add to local state immediately for responsiveness
  setElements(prev => [...prev, newElement]);
  
  // Emit to server
  socket.emit('draw-element', {
    roomId: currentRoom.roomId,
    element: newElement
  });
};
```

#### Mouse Move Handler
```typescript
const handleMouseMove = (e, currentElement) => {
  if (!socket || !currentRoom || !currentElement) return;

  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  let updatedElement;
  
  if (currentElement.type === 'shape') {
    updatedElement = updateShapeElement(currentElement, x, y);
  } else if (currentElement.type === 'drawing') {
    updatedElement = {
      ...currentElement,
      points: [...(currentElement.points || []), { x, y }]
    };
  } else {
    return; // Text elements don't update during mouse move
  }
  
  setCurrentElement(updatedElement);
  
  // Update local state
  setElements(prev => 
    prev.map(el => 
      el.id === currentElement.id ? updatedElement : el
    )
  );
  
  // Emit update to server
  socket.emit('update-element', {
    roomId: currentRoom.roomId,
    elementId: currentElement.id,
    updates: updatedElement
  });
};
```

#### Mouse Up Handler
```typescript
const handleMouseUp = (currentElement) => {
  if (!socket || !currentRoom || !currentElement) return;

  const completedElement = {
    ...currentElement,
    isComplete: true
  };
  
  setCurrentElement(null);
  setIsDrawing(false);
  
  // Update local state with completed element
  setElements(prev => 
    prev.map(el => 
      el.id === currentElement.id ? completedElement : el
    )
  );
  
  // Emit completion to server
  socket.emit('complete-element', {
    roomId: currentRoom.roomId,
    elementId: currentElement.id,
    element: completedElement
  });
  
  // Add to undo stack
  setUndoStack(prev => [...prev, elements]);
  setRedoStack([]); // Clear redo stack on new action
};
```

## Socket Event Listeners

### Canvas Cleared Event
```typescript
socket.on('canvas-cleared', (data) => {
  console.log('Canvas cleared for room:', data.roomId);
  
  // Clear all elements from local state
  setElements([]);
  
  // Clear undo/redo history
  setUndoStack([]);
  setRedoStack([]);
  
  // Clear any active drawing states
  setCurrentElement(null);
  setIsDrawing(false);
  
  // Clear canvas context if you have direct canvas manipulation
  if (canvasRef.current) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  // Show success message to user
  showNotification('Canvas cleared successfully', 'success');
});
```

### Element Drawn Event
```typescript
socket.on('element-drawn', (data) => {
  console.log('Element drawn:', data.element.id, 'shapeType:', data.element.shapeType);
  
  setElements(prevElements => {
    // Avoid duplicates
    const exists = prevElements.some(el => el.id === data.element.id);
    if (!exists) {
      return [...prevElements, data.element];
    }
    return prevElements;
  });
});
```

### Element Updated Event
```typescript
socket.on('element-updated', (data) => {
  console.log('Element updated:', data.elementId, 'shapeType:', data.updates.shapeType);
  
  setElements(prevElements => 
    prevElements.map(element => 
      element.id === data.elementId 
        ? { ...element, ...data.updates }
        : element
    )
  );
});
```

### Element Completed Event
```typescript
socket.on('element-completed', (data) => {
  console.log('Element completed:', data.element.id, 'shapeType:', data.element.shapeType);
  
  setElements(prevElements => 
    prevElements.map(element => 
      element.id === data.element.id 
        ? data.element  // Replace with complete element data
        : element
    )
  );
});
```

## Integration with Existing Components

### Canvas Component Integration
The Canvas component now accepts additional props:
```typescript
interface CanvasProps {
  // ... existing props
  socket?: any;
  currentRoom?: { roomId: string } | null;
  onClearCanvas?: () => void;
}
```

### Whiteboard Component Integration
The Whiteboard component passes socket and room information to Canvas:
```typescript
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
  socket={socket}
  currentRoom={room}
  onClearCanvas={handleClear}
/>
```

## Notification System

The application includes a notification system for user feedback:

```typescript
// Show different types of notifications
showNotification('Canvas cleared successfully', 'success');
showNotification('Clearing canvas...', 'info');
showNotification('Error connecting to server', 'error');
```

## Usage Example

```typescript
// In your React component
import { useSocketEvents } from '../hooks/useSocketEvents';

const MyComponent = () => {
  const {
    clearCanvas,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  } = useSocketEvents({
    socket,
    currentRoom,
    elements,
    setElements,
    setUndoStack,
    setRedoStack,
    setCurrentElement,
    setIsDrawing,
    canvasRef
  });

  // Use the handlers in your mouse events
  const onMouseDown = (e) => {
    handleMouseDown(e, selectedTool, color, strokeWidth);
  };

  const onMouseMove = (e) => {
    handleMouseMove(e, currentElement);
  };

  const onMouseUp = () => {
    handleMouseUp(currentElement);
  };

  return (
    <canvas
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    />
  );
};
```

## Backend Requirements

The backend should handle these socket events:
- `clear-canvas`: Clear all elements for a room
- `draw-element`: Handle new element creation
- `update-element`: Handle element updates during drawing
- `complete-element`: Handle element completion

The backend should emit these events to all clients in the room:
- `canvas-cleared`: Notify all clients when canvas is cleared
- `element-drawn`: Broadcast new elements to all clients
- `element-updated`: Broadcast element updates to all clients
- `element-completed`: Broadcast completed elements to all clients

## Benefits

1. **Real-time Collaboration**: All users see changes immediately
2. **Shape Support**: Proper handling of rectangles, circles, and lines
3. **User Feedback**: Notifications for important actions
4. **Error Handling**: Graceful fallbacks when socket is unavailable
5. **Performance**: Optimized updates with throttling
6. **History Management**: Proper undo/redo integration

This enhanced system provides a robust foundation for real-time collaborative whiteboard functionality. 