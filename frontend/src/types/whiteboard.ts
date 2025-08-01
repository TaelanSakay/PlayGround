export interface WhiteboardElement {
  id: string;
  type: 'drawing' | 'text' | 'shape' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  fillColor?: string; // New: fill color for shapes
  strokeWidth: number;
  fontSize?: number;
  fontFamily?: string;
  shapeType?: 'rectangle' | 'circle' | 'line';
  imageData?: string; // New: base64 image data for image elements
  timestamp: number;
  userId: string;
  isComplete?: boolean; // New flag for two-stage validation
}

export interface Room {
  id: string;
  name: string;
  roomId: string;
  createdBy: string;
  createdAt: string;
  elements?: WhiteboardElement[];
}

export interface User {
  id: string;
  name: string;
  cursor?: { x: number; y: number };
}

export interface DrawingTool {
  type: 'pen' | 'eraser' | 'text' | 'rectangle' | 'circle' | 'line' | 'paintbucket';
  color: string;
  strokeWidth: number;
}

export interface CursorPosition {
  x: number;
  y: number;
} 