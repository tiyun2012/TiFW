# Nebula Engine Framework Documentation

## Overview

Nebula Engine is a visual node-based scripting framework designed to bridge the gap between web-based visual editors and C++ game engine logic. 

The architecture is divided into two distinct layers:
1.  **The Editor (UI Layer):** React-based interface for graph manipulation.
2.  **The Core (Engine Layer):** Logic for graph evaluation (JS simulation) and transpilation (C++ generation).

## Architecture

### 1. Data Structures (`types.ts`)
The entire state of the engine is serializable.
*   **NodeData**: Represents a single node instance.
*   **Connection**: Represents a link between two sockets.
*   **NodeType**: Enum defining available operations.

### 2. The Node System (`engine/NodeSystem.ts`)
This is the heart of the framework. It decouples the behavior of a node from the UI.

## How to Implement a New Node

To add a new node (e.g., `MATH_MULTIPLY`) to the framework, follow these 3 steps:

### Step 1: Define the Type
Open `types.ts` and add the new type to the Enum.

```typescript
export enum NodeType {
  // ... existing types
  MATH_MULTIPLY = 'MATH_MULTIPLY',
}
```

### Step 2: Register Node Behavior
Open `engine/NodeSystem.ts` and add the definition to `NODE_REGISTRY`.

```typescript
[NodeType.MATH_MULTIPLY]: {
  // 1. Simulation Logic (JavaScript)
  evaluate: (inputs, state) => {
    const a = inputs['A'] ?? 0;
    const b = inputs['B'] ?? 1;
    return a * b;
  },
  
  // 2. Transpilation Logic (C++)
  generateCpp: (inputs, id) => {
    const a = inputs['A'] ?? '0.0f';
    const b = inputs['B'] ?? '1.0f';
    // Returns lines of C++ code
    return `float val_${id} = ${a} * ${b};`;
  }
}
```

### Step 3: Register UI Component
Open `constants.ts` to define the default input/output sockets for the Drag-and-Drop menu (if applicable) or initial graph state.

```typescript
{
  type: NodeType.MATH_MULTIPLY,
  label: 'Multiply',
  inputs: [
    { id: 'in-a', name: 'A', type: SocketType.FLOAT },
    { id: 'in-b', name: 'B', type: SocketType.FLOAT }
  ],
  outputs: [
    { id: 'out', name: 'Result', type: SocketType.FLOAT }
  ]
}
```

## API Reference

### `NodeSystem.evaluateGraph(nodes, connections, time)`
Runs one frame of the simulation in the browser.
*   **Returns:** `GameState` object used to render the `Viewport`.

### `NodeSystem.generateCpp(nodes, connections)`
Traverses the graph and produces a C++ source string compatible with the Entity Component System (ECS) defined in the template.

## Future Extensibility
*   **Custom Shaders:** The `Viewport` component can be extended to use WebGL, accepting uniforms derived from `evaluateGraph`.
*   **Plugin System:** The `NODE_REGISTRY` can be exported to allow runtime injection of new node types without recompiling the core.
