"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const mongoose_1 = __importStar(require("mongoose"));

const WhiteboardElementSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true, enum: ['drawing', 'text', 'shape'] },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    points: [{ x: Number, y: Number }],
    text: { type: String },
    color: { type: String, required: true, default: '#000000' },
    strokeWidth: { type: Number, required: true, default: 2 },
    fontSize: { type: Number },
    fontFamily: { type: String },
    // NEW FIELD: shapeType for shape elements
    shapeType: {
        type: String,
        enum: ['rectangle', 'circle', 'line'],
        required: function() {
            return this.type === 'shape';
        }
    },
    timestamp: { type: Number, required: true },
    userId: { type: String, required: true },
    isComplete: { type: Boolean, default: false }
});

// Add indexes for better query performance
WhiteboardElementSchema.index({ id: 1 });
WhiteboardElementSchema.index({ type: 1 });
WhiteboardElementSchema.index({ timestamp: 1 });

const RoomSchema = new mongoose_1.Schema({
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

// Add indexes for room queries
RoomSchema.index({ roomId: 1 });
RoomSchema.index({ createdBy: 1 });

exports.Room = mongoose_1.default.model('Room', RoomSchema);