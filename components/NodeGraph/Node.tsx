
import React, { memo } from 'react';
import { NodeData, SocketType } from '../../types';
import { Zap, Activity, Clock, Box, Move, Type, Sliders } from 'lucide-react';

interface NodeProps {
  data: NodeData;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onSocketMouseDown: (e: React.MouseEvent, nodeId: string, socketId: string, isInput: boolean) => void;
}

const NodeIcon = ({ type }: { type: NodeData['type'] }) => {
  switch (type) {
    case 'EVENT_UPDATE': return <Zap className="w-4 h-4 text-yellow-400" />;
    case 'VARIABLE_TIME': return <Clock className="w-4 h-4 text-blue-400" />;
    case 'MATH_SINE': return <Activity className="w-4 h-4 text-purple-400" />;
    case 'MATH_CLAMP': return <Sliders className="w-4 h-4 text-orange-400" />;
    case 'ACTION_SET_POSITION': return <Move className="w-4 h-4 text-green-400" />;
    case 'ACTION_SET_COLOR': return <Box className="w-4 h-4 text-red-400" />;
    default: return <Type className="w-4 h-4 text-gray-400" />;
  }
};

export const Node = memo(({ data, isSelected, onMouseDown, onSocketMouseDown }: NodeProps) => {
  return (
    <div
      className={`absolute flex flex-col min-w-[160px] bg-slate-800 rounded-md shadow-lg border border-slate-700 select-none transition-shadow ${
        isSelected ? 'ring-2 ring-blue-500 shadow-blue-500/20' : 'hover:border-slate-600'
      }`}
      style={{ 
        left: data.position.x, 
        top: data.position.y,
        zIndex: isSelected ? 50 : 10
      }}
    >
      {/* Header */}
      <div 
        className="h-8 flex items-center gap-2 px-3 bg-slate-900/50 rounded-t-md cursor-grab active:cursor-grabbing border-b border-slate-700"
        onMouseDown={(e) => onMouseDown(e, data.id)}
      >
        <NodeIcon type={data.type} />
        <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">{data.label}</span>
      </div>

      {/* Body */}
      <div className="p-3 flex justify-between gap-4">
        {/* Inputs */}
        <div className="flex flex-col gap-2">
          {data.inputs.map((socket) => (
            <div key={socket.id} className="flex items-center gap-2 h-5">
              <div
                className={`w-3 h-3 rounded-full border border-slate-500 hover:scale-125 transition-transform cursor-crosshair ${
                  socket.type === SocketType.FLOW ? 'bg-white rounded-sm' :
                  socket.type === SocketType.FLOAT ? 'bg-blue-500' :
                  socket.type === SocketType.VECTOR3 ? 'bg-purple-500' : 'bg-pink-500'
                }`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSocketMouseDown(e, data.id, socket.id, true);
                }}
              />
              <span className="text-xs text-slate-400">{socket.name}</span>
            </div>
          ))}
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-2 items-end">
          {data.outputs.map((socket) => (
            <div key={socket.id} className="flex items-center gap-2 h-5">
              <span className="text-xs text-slate-400">{socket.name}</span>
              <div
                className={`w-3 h-3 rounded-full border border-slate-500 hover:scale-125 transition-transform cursor-crosshair ${
                  socket.type === SocketType.FLOW ? 'bg-white rounded-sm' :
                  socket.type === SocketType.FLOAT ? 'bg-blue-500' :
                  socket.type === SocketType.VECTOR3 ? 'bg-purple-500' : 'bg-pink-500'
                }`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSocketMouseDown(e, data.id, socket.id, false);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

Node.displayName = 'Node';
