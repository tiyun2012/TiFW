
export type Vector2 = { x: number; y: number };
export type Vector3 = { x: number; y: number; z: number };

export enum SocketType {
  FLOW = 'FLOW', // Execution flow
  FLOAT = 'FLOAT',
  VECTOR3 = 'VECTOR3',
  COLOR = 'COLOR',
}

export interface NodeSocket {
  id: string;
  name: string;
  type: SocketType;
  isInput: boolean; // if true, it's on the left. if false, right.
  value?: any; // Default value if not connected
}

export enum NodeType {
  EVENT_UPDATE = 'EVENT_UPDATE',
  MATH_ADD = 'MATH_ADD',
  MATH_SINE = 'MATH_SINE',
  MATH_CLAMP = 'MATH_CLAMP',
  VALUE_FLOAT = 'VALUE_FLOAT',
  VALUE_VECTOR3 = 'VALUE_VECTOR3',
  ACTION_SET_POSITION = 'ACTION_SET_POSITION',
  ACTION_SET_COLOR = 'ACTION_SET_COLOR',
  VARIABLE_TIME = 'VARIABLE_TIME',
}

export interface NodeData {
  id: string;
  type: NodeType;
  position: Vector2;
  label: string;
  inputs: NodeSocket[];
  outputs: NodeSocket[];
  state?: any; // Internal node state (e.g. constant values)
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromSocketId: string;
  toNodeId: string;
  toSocketId: string;
}

export interface GameState {
  time: number;
  cubePosition: Vector3;
  cubeColor: string; // Hex
}

export interface DragState {
  isDragging: boolean;
  isConnecting: boolean;
  isPanning: boolean;
  nodeId?: string;
  socketId?: string;
  startPos: Vector2;
  currPos: Vector2;
}

export type LogMessage = {
  id: string;
  sender: 'system' | 'ai' | 'user';
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  timestamp: Date;
};