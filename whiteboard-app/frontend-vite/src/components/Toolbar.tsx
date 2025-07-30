import React from 'react';

interface ToolbarProps {
  selectedTool: string;
  onToolChange: (tool: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const tools = [
    { id: 'pen', icon: '✏️', label: 'Pen' },
    { id: 'eraser', icon: '🧽', label: 'Eraser' },
    { id: 'text', icon: 'T', label: 'Text' },
    { id: 'rectangle', icon: '⬜', label: 'Rectangle' },
    { id: 'circle', icon: '⭕', label: 'Circle' },
    { id: 'line', icon: '➖', label: 'Line' },
  ];

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFA500', '#800080', '#008000', '#FFC0CB', '#A52A2A', '#808080', '#FFFFFF'
  ];

  const strokeWidths = [1, 2, 4, 6, 8, 12];

  return (
    <div className="p-4 space-y-6">
      {/* Undo/Redo */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
          History
        </h3>
        <div className="space-y-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`w-full h-10 flex items-center justify-center rounded-md transition-colors ${
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
            className={`w-full h-10 flex items-center justify-center rounded-md transition-colors ${
              canRedo
                ? 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-transparent'
            }`}
            title="Redo"
          >
            <span className="text-lg">↷</span>
          </button>
        </div>
      </div>

      {/* Tools */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
          Tools
        </h3>
        <div className="space-y-2">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`w-full h-10 flex items-center justify-center rounded-md transition-colors ${
                selectedTool === tool.id
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
              }`}
              title={tool.label}
            >
              <span className="text-lg">{tool.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <h3 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
          Color
        </h3>
        <div className="space-y-2">
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-full h-10 rounded-md border-2 border-gray-200 cursor-pointer"
          />
          <div className="grid grid-cols-4 gap-1">
            {colors.map((colorOption) => (
              <button
                key={colorOption}
                onClick={() => onColorChange(colorOption)}
                className={`w-6 h-6 rounded border-2 ${
                  color === colorOption ? 'border-gray-800' : 'border-gray-300'
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
        <div className="space-y-2">
          {strokeWidths.map((width) => (
            <button
              key={width}
              onClick={() => onStrokeWidthChange(width)}
              className={`w-full h-8 flex items-center justify-center rounded-md transition-colors ${
                strokeWidth === width
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-2 border-transparent'
              }`}
            >
              <div
                className="bg-current rounded-full"
                style={{ width: width, height: width }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Toolbar; 