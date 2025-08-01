import mongoose, { Schema, Document } from 'mongoose';

export interface IWhiteboardElement {
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

export interface IRoom extends Document {
  roomId: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  elements: IWhiteboardElement[];
  activeUsers: string[];
}

const WhiteboardElementSchema = new Schema<IWhiteboardElement>({
  id: { type: String, required: true },
  type: { type: String, required: true, enum: ['drawing', 'text', 'shape', 'image'] },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number },
  height: { type: Number },
  points: [{ x: Number, y: Number }],
  text: { type: String },
  color: { type: String, required: true, default: '#000000' },
  fillColor: { type: String }, // New: fill color for shapes
  strokeWidth: { type: Number, required: true, default: 2 },
  fontSize: { type: Number },
  fontFamily: { type: String },
  shapeType: { type: String, enum: ['rectangle', 'circle', 'line'] },
  imageData: { type: String }, // New: base64 image data for image elements
  timestamp: { type: Number, required: true },
  userId: { type: String, required: true },
  isComplete: { type: Boolean, default: false }
});

const RoomSchema = new Schema<IRoom>({
  roomId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  },
  name: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  elements: [WhiteboardElementSchema],
  activeUsers: [{ type: String }]
});

export const Room = mongoose.model<IRoom>('Room', RoomSchema); 