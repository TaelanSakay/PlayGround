import React, { useState } from 'react';

interface ToolbarProps {
  selectedTool: string;
  onToolChange: (tool: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  fillColor: string; // New: fill color prop
  onFillColorChange: (color: string) => void; // New: fill color change handler
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: () => void; // New: download handler
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onToolChange,
  color,
  onColorChange,
  fillColor,
  onFillColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  onClear,
  onDownload,
  canUndo,
  canRedo,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const tools = [
    { id: 'pen', icon: '✏️', label: 'Pen' },
    { id: 'eraser', icon: '🧽', label: 'Eraser' },
    { id: 'text', icon: 'T', label: 'Text' },
    { id: 'rectangle', icon: '⬜', label: 'Rectangle' },
    { id: 'circle', icon: '⭕', label: 'Circle' },
    { id: 'line', icon: '➖', label: 'Line' },
    { id: 'paintbucket', icon: '🪣', label: 'Paint Bucket' },
  ];

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFA500', '#800080', '#008000', '#FFC0CB', '#A52A2A', '#808080', '#FFFFFF'
  ];

  const strokeWidths = [1, 2, 4, 6, 8, 12];

  return (
    <div className={`bg-white shadow-sm border-r transition-all duration-300 ${
      isExpanded ? 'w-80' : 'w-16'
    }`}>
      {/* Toggle Button */}
      <div className="p-2 border-b border-gray-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full h-10 flex items-center justify-center rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
          title={isExpanded ? 'Collapse Toolbar' : 'Expand Toolbar'}
        >
          <span className="text-lg">{isExpanded ? '◀' : '▶'}</span>
        </button>
      </div>

      {/* Toolbar Content */}
      <div className={`p-4 space-y-6 ${isExpanded ? 'block' : 'hidden'}`}>
        {/* Undo/Redo */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
            History
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`h-10 flex items-center justify-center rounded-md transition-colors ${
                canUndo
                  ? 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-transparent'
              }`}
              title="Undo"
            >
              <span className="text-lg">↶</span>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`h-10 flex items-center justify-center rounded-md transition-colors ${
                canRedo
                  ? 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-transparent'
              }`}
              title="Redo"
            >
              <span className="text-lg">↷</span>
            </button>
            <button
              onClick={() => {
                console.log('Clear button clicked in Toolbar');
                onClear();
              }}
              className="h-10 flex items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100 border-2 border-transparent transition-colors"
              title="Clear Canvas"
            >
              <span className="text-lg">🗑️</span>
            </button>
            <button
              onClick={onDownload}
              className="h-10 flex items-center justify-center rounded-md bg-green-50 text-green-600 hover:bg-green-100 border-2 border-transparent transition-colors"
              title="Download Canvas"
            >
              <span className="text-lg">💾</span>
            </button>
          </div>
        </div>

        {/* Tools */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
            Tools
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => onToolChange(tool.id)}
                className={`h-12 flex flex-col items-center justify-center rounded-md transition-colors ${
                  selectedTool === tool.id
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                }`}
                title={tool.label}
              >
                <span className="text-lg">{tool.icon}</span>
                <span className="text-xs mt-1">{tool.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Color Picker */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
            Stroke Color
          </h3>
          <div className="space-y-3">
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-full h-12 rounded-md border-2 border-gray-200 cursor-pointer"
            />
            <div className="grid grid-cols-7 gap-2">
              {colors.map((colorOption) => (
                <button
                  key={colorOption}
                  onClick={() => onColorChange(colorOption)}
                  className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110 ${
                    color === colorOption ? 'border-gray-800 scale-110' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: colorOption }}
                  title={colorOption}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Fill Color Picker */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
            Fill Color
          </h3>
          <div className="space-y-3">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => onFillColorChange(e.target.value)}
              className="w-full h-12 rounded-md border-2 border-gray-200 cursor-pointer"
            />
            <div className="grid grid-cols-7 gap-2">
              {colors.map((colorOption) => (
                <button
                  key={colorOption}
                  onClick={() => onFillColorChange(colorOption)}
                  className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110 ${
                    fillColor === colorOption ? 'border-gray-800 scale-110' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: colorOption }}
                  title={colorOption}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Stroke Width */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
            Width
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {strokeWidths.map((width) => (
              <button
                key={width}
                onClick={() => onStrokeWidthChange(width)}
                className={`h-10 flex items-center justify-center rounded-md transition-colors ${
                  strokeWidth === width
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div
                  className="bg-current rounded-full"
                  style={{ width: Math.min(width, 8), height: Math.min(width, 8) }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsed State - Show only selected tool */}
      {!isExpanded && (
        <div className="p-2 space-y-2">
          <button
            onClick={() => onToolChange(selectedTool)}
            className="w-full h-10 flex items-center justify-center rounded-md bg-blue-100 text-blue-600 border-2 border-blue-300"
            title={tools.find(t => t.id === selectedTool)?.label || 'Selected Tool'}
          >
            <span className="text-lg">{tools.find(t => t.id === selectedTool)?.icon || '✏️'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar; 