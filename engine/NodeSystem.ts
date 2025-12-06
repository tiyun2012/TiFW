import { NodeType, NodeData, Connection, GameState, Vector3 } from '../types';

/**
 * FRAMEWORK CORE
 * This file contains the logic for simulating the graph and generating code.
 * To add new nodes, extend the NODE_REGISTRY.
 */

// --- Registry Interface ---

interface NodeDefinition {
  // Returns the calculated value (float, vector, etc.)
  evaluate: (inputs: Record<string, any>, globalTime: number, nodeId: string) => any;
  
  // Returns the C++ code snippet for this node
  generateCpp: (inputs: Record<string, string>, nodeId: string) => string[];
}

// --- Helper: Clean ID for C++ var names ---
const cleanId = (id: string) => id.replace(/-/g, '_');

// --- The Registry ---
// Define behavior for every node type here.
export const NODE_REGISTRY: Record<NodeType, NodeDefinition> = {
  
  [NodeType.EVENT_UPDATE]: {
    evaluate: () => null,
    generateCpp: () => [] // Entry point, handled by template
  },

  [NodeType.VARIABLE_TIME]: {
    evaluate: (_, t) => t,
    generateCpp: () => ['float t = deltaTime;'] // Simplified for demo
  },

  [NodeType.VALUE_FLOAT]: {
    evaluate: (inputs) => inputs['value'] ?? 0,
    generateCpp: (inputs, id) => [`float val_${cleanId(id)} = ${inputs['value'] ?? '0.0f'};`]
  },

  [NodeType.VALUE_VECTOR3]: {
    evaluate: (inputs) => inputs['value'] ?? { x: 0, y: 0, z: 0 },
    generateCpp: (inputs, id) => {
        // Input is resolved to a string snippet (e.g. "Vector3(0f,0f,0f)" or variable name)
        const v = inputs['value'] || 'Vector3(0.0f, 0.0f, 0.0f)';
        return [`Vector3 vec_${cleanId(id)} = ${v};`];
    }
  },

  [NodeType.MATH_SINE]: {
    evaluate: (inputs) => Math.sin(inputs['In'] ?? 0) * 5, // *5 for visual scale in demo
    generateCpp: (inputs, id) => {
      const inVal = inputs['In'] ?? '0.0f';
      // In C++ std::sin takes radians. 
      return [`float sin_${cleanId(id)} = std::sin(${inVal}) * 5.0f;`];
    }
  },

  [NodeType.MATH_ADD]: {
    evaluate: (inputs) => (inputs['A'] ?? 0) + (inputs['B'] ?? 0),
    generateCpp: (inputs, id) => {
        const a = inputs['A'] ?? '0.0f';
        const b = inputs['B'] ?? '0.0f';
        return [`float add_${cleanId(id)} = ${a} + ${b};`];
    }
  },

  [NodeType.MATH_CLAMP]: {
    evaluate: (inputs) => {
      const val = inputs['Val'] ?? 0;
      const min = inputs['Min'] ?? 0;
      const max = inputs['Max'] ?? 1;
      return Math.max(min, Math.min(max, val));
    },
    generateCpp: (inputs, id) => {
      const val = inputs['Val'] ?? '0.0f';
      const min = inputs['Min'] ?? '0.0f';
      const max = inputs['Max'] ?? '1.0f';
      return [`float clamp_${cleanId(id)} = std::clamp(${val}, ${min}, ${max});`];
    }
  },

  [NodeType.ACTION_SET_POSITION]: {
    evaluate: (inputs) => {
      // Return the vector to be used by the engine to set state
      return { x: 0, y: inputs['Y'] ?? 0, z: 0 }; 
    },
    generateCpp: (inputs) => {
      const y = inputs['Y'] ?? '0.0f';
      return [`transform.position = Vector3(0, ${y}, 0);`];
    }
  },

  [NodeType.ACTION_SET_COLOR]: {
    evaluate: () => '#ffffff',
    generateCpp: () => ['// Set Color Not Implemented in C++ Demo']
  }
};


// --- Engine: Graph Evaluator (JavaScript Simulation) ---

export const evaluateGraph = (
  nodes: NodeData[], 
  connections: Connection[], 
  time: number
): GameState => {
  
  // Default State
  const gameState: GameState = {
    time,
    cubePosition: { x: 0, y: 0, z: 0 },
    cubeColor: '#3b82f6'
  };

  // Cache for node outputs to avoid re-calculating (Memoization)
  const results = new Map<string, any>();

  // Recursive resolver
  const resolveValue = (nodeId: string, socketName: string, fallback: any): any => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return fallback;

    // 1. Check if input socket is connected
    const inputSocket = node.inputs.find(i => i.name === socketName);
    if (!inputSocket) return fallback;

    const connection = connections.find(c => c.toNodeId === nodeId && c.toSocketId === inputSocket.id);

    if (connection) {
      // 2. Recursively solve the source node
      return solveNode(connection.fromNodeId);
    } 
    
    // 3. If not connected, use default value from socket
    return inputSocket.value ?? fallback;
  };

  const solveNode = (nodeId: string): any => {
    if (results.has(nodeId)) return results.get(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return 0;

    const def = NODE_REGISTRY[node.type];
    if (!def) return 0;

    // Gather Inputs
    const inputValues: Record<string, any> = {};
    node.inputs.forEach(inp => {
        inputValues[inp.name] = resolveValue(nodeId, inp.name, inp.value);
    });

    // Execute Logic
    const result = def.evaluate(inputValues, time, nodeId);
    results.set(nodeId, result);
    return result;
  };

  // Find Action Nodes (The roots of our execution graph)
  const posNode = nodes.find(n => n.type === NodeType.ACTION_SET_POSITION);
  
  if (posNode) {
     const pos = solveNode(posNode.id);
     if (pos) gameState.cubePosition = pos;
  }

  return gameState;
};


// --- Engine: Transpiler (C++ Generator) ---

export const generateCppCode = (nodes: NodeData[], connections: Connection[]): string => {
  const lines: string[] = [];
  const processedNodes = new Set<string>();

  // Helper to resolve input variable name (or literal)
  const resolveInputCode = (nodeId: string, socketName: string, fallback: string): string => {
    const node = nodes.find(n => n.id === nodeId);
    const inputSocket = node?.inputs.find(i => i.name === socketName);
    if (!inputSocket) return fallback;

    const connection = connections.find(c => c.toNodeId === nodeId && c.toSocketId === inputSocket.id);
    if (connection) {
       const fromNode = nodes.find(n => n.id === connection.fromNodeId);
       if (fromNode) {
         // Variable naming convention based on Node Type + ID
         // For simplification, we assume the previous node generated a variable.
         // In a real framework, outputs need specific names.
         
         // Special case for simple value nodes or built-ins
         if (fromNode.type === NodeType.VARIABLE_TIME) return `deltaTime`;
         
         // Standard variable reference (e.g. clamp_node_5)
         const prefixMap: Partial<Record<NodeType, string>> = {
            [NodeType.MATH_SINE]: 'sin',
            [NodeType.MATH_CLAMP]: 'clamp',
            [NodeType.MATH_ADD]: 'add',
            [NodeType.VALUE_FLOAT]: 'val',
            [NodeType.VALUE_VECTOR3]: 'vec',
         };
         const prefix = prefixMap[fromNode.type] || 'var';
         return `${prefix}_${cleanId(fromNode.id)}`;
       }
    }
    
    // Literal
    if (inputSocket.value !== undefined) {
      if (typeof inputSocket.value === 'number') {
        return `${inputSocket.value.toFixed(1)}f`;
      }
      if (typeof inputSocket.value === 'object' && 'x' in inputSocket.value) {
        return `Vector3(${inputSocket.value.x}f, ${inputSocket.value.y}f, ${inputSocket.value.z ?? 0}f)`;
      }
      return String(inputSocket.value);
    }
    return fallback;
  };

  // Topological sort or recursive generation is usually better.
  // For this demo, we iterate nodes in a specific order or just naive list for variables, 
  // then actions at the end.
  
  // Naive Approach: Generate Variable Declarations first (Time, Values, Math)
  const computationNodes = nodes.filter(n => 
    n.type !== NodeType.EVENT_UPDATE && 
    !n.type.startsWith('ACTION_') && 
    n.type !== NodeType.VARIABLE_TIME
  );

  computationNodes.forEach(node => {
      const def = NODE_REGISTRY[node.type];
      if (def) {
          const inputs: Record<string, string> = {};
          node.inputs.forEach(i => {
              inputs[i.name] = resolveInputCode(node.id, i.name, '0.0f');
          });
          const code = def.generateCpp(inputs, node.id);
          lines.push(...code.map(l => `    ${l}`));
      }
  });

  lines.push(''); // spacer

  // Generate Actions
  const actionNodes = nodes.filter(n => n.type.startsWith('ACTION_'));
  actionNodes.forEach(node => {
      const def = NODE_REGISTRY[node.type];
      if (def) {
          const inputs: Record<string, string> = {};
          node.inputs.forEach(i => {
              inputs[i.name] = resolveInputCode(node.id, i.name, '0.0f');
          });
          const code = def.generateCpp(inputs, node.id);
          lines.push(...code.map(l => `    ${l}`));
      }
  });

  return lines.join('\n');
};