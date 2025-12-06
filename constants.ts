
import { NodeType, NodeData, SocketType } from './types';

export const INITIAL_NODES: NodeData[] = [
  {
    id: 'node-1',
    type: NodeType.EVENT_UPDATE,
    label: 'Event: Update',
    position: { x: 50, y: 50 },
    inputs: [],
    outputs: [{ id: 'out-1', name: 'Next', type: SocketType.FLOW, isInput: false }],
  },
  {
    id: 'node-2',
    type: NodeType.VARIABLE_TIME,
    label: 'Time (t)',
    position: { x: 50, y: 200 },
    inputs: [],
    outputs: [{ id: 'out-time', name: 'Time', type: SocketType.FLOAT, isInput: false }],
  },
  {
    id: 'node-3',
    type: NodeType.MATH_SINE,
    label: 'Sine',
    position: { x: 250, y: 200 },
    inputs: [{ id: 'in-sin', name: 'In', type: SocketType.FLOAT, isInput: true }],
    outputs: [{ id: 'out-sin', name: 'Out', type: SocketType.FLOAT, isInput: false }],
  },
  {
    id: 'node-5',
    type: NodeType.MATH_CLAMP,
    label: 'Clamp',
    position: { x: 450, y: 200 },
    inputs: [
      { id: 'in-clamp-val', name: 'Val', type: SocketType.FLOAT, isInput: true },
      { id: 'in-clamp-min', name: 'Min', type: SocketType.FLOAT, isInput: true, value: -2.0 },
      { id: 'in-clamp-max', name: 'Max', type: SocketType.FLOAT, isInput: true, value: 2.0 }
    ],
    outputs: [{ id: 'out-clamp', name: 'Out', type: SocketType.FLOAT, isInput: false }],
  },
  {
    id: 'node-4',
    type: NodeType.ACTION_SET_POSITION,
    label: 'Set Position',
    position: { x: 680, y: 50 },
    inputs: [
      { id: 'in-flow', name: 'Exec', type: SocketType.FLOW, isInput: true },
      { id: 'in-pos-y', name: 'Y', type: SocketType.FLOAT, isInput: true, value: 0 },
    ],
    outputs: [{ id: 'out-flow', name: 'Next', type: SocketType.FLOW, isInput: false }],
  }
];

export const INITIAL_CONNECTIONS = [
  {
    id: 'conn-1',
    fromNodeId: 'node-1',
    fromSocketId: 'out-1',
    toNodeId: 'node-4',
    toSocketId: 'in-flow',
  },
  {
    id: 'conn-2',
    fromNodeId: 'node-2',
    fromSocketId: 'out-time',
    toNodeId: 'node-3',
    toSocketId: 'in-sin',
  },
  {
    id: 'conn-3',
    fromNodeId: 'node-3',
    fromSocketId: 'out-sin',
    toNodeId: 'node-5',
    toSocketId: 'in-clamp-val',
  },
  {
    id: 'conn-4',
    fromNodeId: 'node-5',
    fromSocketId: 'out-clamp',
    toNodeId: 'node-4',
    toSocketId: 'in-pos-y',
  }
];

export const MOCK_C_PLUS_PLUS_TEMPLATE = `
#include "NebulaEngine.h"
#include <algorithm> // For std::clamp

class CustomEntity : public Entity {
public:
    void Update(float deltaTime) override {
        // GENERATED CODE START
        {{CODE_BODY}}
        // GENERATED CODE END
    }
};
`;
