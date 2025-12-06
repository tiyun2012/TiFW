import React, { useState, useEffect, useRef } from 'react';
import { NodeData, Connection, Vector2, NodeType, SocketType, GameState, DragState, LogMessage } from './types';
import { INITIAL_NODES, INITIAL_CONNECTIONS, MOCK_C_PLUS_PLUS_TEMPLATE } from './constants';
import { Node as NodeComponent } from './components/NodeGraph/Node';
import { Viewport } from './components/Viewport';
import { CodePanel } from './components/CodePanel';
import { Play, Pause, Plus, MessageSquare, Code2, Monitor, Loader2, Zap, Brain, Eye, Clapperboard, Upload, X, Key, GripVertical, GripHorizontal, Activity } from 'lucide-react';
import { chatFast, chatThinking, analyzeImage, generateVideo } from './services/geminiService';
import { evaluateGraph, generateCppCode } from './engine/NodeSystem';

// Helper to calculate Bezier path
const getPath = (start: Vector2, end: Vector2) => {
  const deltaX = Math.abs(end.x - start.x);
  const controlPointOffset = Math.max(deltaX * 0.5, 50);
  return `M ${start.x} ${start.y} C ${start.x + controlPointOffset} ${start.y}, ${end.x - controlPointOffset} ${end.y}, ${end.x} ${end.y}`;
};

// Helper for file reading
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/png;base64, prefix for API
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

type AIMode = 'fast' | 'think' | 'vision' | 'veo';

function App() {
  // Graph State
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [connections, setConnections] = useState<Connection[]>(INITIAL_CONNECTIONS);
  const [selection, setSelection] = useState<string | null>(null);
  const [pan, setPan] = useState<Vector2>({ x: 0, y: 0 });
  const [status, setStatus] = useState("Ready. Middle-click to pan, Left-click to select.");

  // Interaction State
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isConnecting: false,
    isPanning: false,
    startPos: { x: 0, y: 0 },
    currPos: { x: 0, y: 0 }
  });

  // Layout State
  const [layout, setLayout] = useState({
    sidebarWidth: 400,
    viewportHeight: 300
  });
  const [resizing, setResizing] = useState<'sidebar' | 'viewport' | null>(null);

  // Game/Runtime State
  const [isPlaying, setIsPlaying] = useState(true);
  const [gameState, setGameState] = useState<GameState>({
    time: 0,
    cubePosition: { x: 0, y: 0, z: 0 },
    cubeColor: '#3b82f6'
  });

  // Generated Code State
  const [generatedCode, setGeneratedCode] = useState("");
  
  // AI/Chat State
  const [activeTab, setActiveTab] = useState<'code' | 'ai'>('code');
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<LogMessage[]>([
    { id: '1', sender: 'system', text: 'Welcome to Nebula Engine.', timestamp: new Date() }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('fast');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showKeySelector, setShowKeySelector] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  // --- Layout Resizing ---
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      e.preventDefault();

      if (resizing === 'sidebar') {
        const newWidth = window.innerWidth - e.clientX;
        setLayout(prev => ({
          ...prev,
          sidebarWidth: Math.max(250, Math.min(newWidth, window.innerWidth - 300))
        }));
        setStatus(`Resizing Sidebar: ${Math.round(newWidth)}px`);
      }

      if (resizing === 'viewport') {
        const newHeight = e.clientY - 48; // Header offset
        setLayout(prev => ({
          ...prev,
          viewportHeight: Math.max(150, Math.min(newHeight, window.innerHeight - 200))
        }));
        setStatus(`Resizing Viewport: ${Math.round(newHeight)}px`);
      }
    };

    const handleGlobalMouseUp = () => {
      setResizing(null);
      setStatus("Ready.");
    };

    if (resizing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = resizing === 'sidebar' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  // --- Graph Interaction Handlers ---

  const handleGraphMouseDown = (e: React.MouseEvent) => {
    // Middle click or Left click on background
    if (e.button === 1 || e.target === containerRef.current) {
      e.preventDefault();
      setDragState(prev => ({
        ...prev,
        isPanning: true,
        startPos: { x: e.clientX, y: e.clientY }
      }));
      setStatus("Panning Viewport...");
    } else {
      setSelection(null);
      setStatus("Ready.");
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelection(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    setStatus(`Dragging ${node?.label || 'Node'}...`);

    setDragState({
      isDragging: true,
      isConnecting: false,
      isPanning: false,
      nodeId,
      startPos: { x: e.clientX, y: e.clientY },
      currPos: { x: e.clientX, y: e.clientY }
    });
  };

  const handleSocketMouseDown = (e: React.MouseEvent, nodeId: string, socketId: string, isInput: boolean) => {
    e.stopPropagation();
    if (isInput) return; // Only drag from outputs
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Calculate World Space Start Position for the connection line
    const worldX = (e.clientX - containerRect.left) - pan.x;
    const worldY = (e.clientY - containerRect.top) - pan.y;

    const node = nodes.find(n => n.id === nodeId);
    const socket = node?.outputs.find(s => s.id === socketId);
    setStatus(`Connecting from ${node?.label}.${socket?.name}... Drag to compatible input.`);

    setDragState({
      isDragging: false,
      isConnecting: true,
      isPanning: false,
      nodeId,
      socketId,
      startPos: { x: worldX, y: worldY },
      currPos: { x: worldX, y: worldY }
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    if (dragState.isPanning) {
      const newPanX = pan.x + e.movementX;
      const newPanY = pan.y + e.movementY;
      setPan({ x: newPanX, y: newPanY });
      setStatus(`Panning: ${Math.round(newPanX)}, ${Math.round(newPanY)}`);
    }
    else if (dragState.isDragging && dragState.nodeId) {
      // Delta is the same in screen space and world space (scale 1)
      const deltaX = e.clientX - dragState.currPos.x;
      const deltaY = e.clientY - dragState.currPos.y;
      
      setNodes(prev => prev.map(n => {
        if (n.id === dragState.nodeId) {
          const newX = n.position.x + deltaX;
          const newY = n.position.y + deltaY;
          setStatus(`Moved Node to: ${Math.round(newX)}, ${Math.round(newY)}`);
          return { ...n, position: { x: newX, y: newY } };
        }
        return n;
      }));

      setDragState(prev => ({ ...prev, currPos: { x: e.clientX, y: e.clientY } }));
    } 
    else if (dragState.isConnecting) {
      // Update current position in World Space
      const worldX = (e.clientX - containerRect.left) - pan.x;
      const worldY = (e.clientY - containerRect.top) - pan.y;

      setDragState(prev => ({
        ...prev,
        currPos: { x: worldX, y: worldY }
      }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    let finalStatus = "Ready.";

    if (dragState.isConnecting) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if(containerRect) {
         // Mouse pos in World Space
         const mouseX = (e.clientX - containerRect.left) - pan.x;
         const mouseY = (e.clientY - containerRect.top) - pan.y;
         
         const targetNode = nodes.find(n => 
           mouseX >= n.position.x && mouseX <= n.position.x + 160 &&
           mouseY >= n.position.y && mouseY <= n.position.y + 100
         );
         
         if (targetNode && targetNode.id !== dragState.nodeId) {
             const input = targetNode.inputs[0];
             if (input) {
               const newConn: Connection = {
                 id: `conn-${Date.now()}`,
                 fromNodeId: dragState.nodeId!,
                 fromSocketId: dragState.socketId!,
                 toNodeId: targetNode.id,
                 toSocketId: input.id
               };
               setConnections(prev => [...prev, newConn]);
               finalStatus = "Connection Created.";
             }
         }
      }
    }

    setDragState({
      isDragging: false,
      isConnecting: false,
      isPanning: false,
      startPos: { x: 0, y: 0 },
      currPos: { x: 0, y: 0 }
    });
    
    setStatus(finalStatus);
  };

  // --- FRAMEWORK: Simulation Loop ---
  // Now delegates to engine/NodeSystem
  useEffect(() => {
    if (!isPlaying) return;

    let frameId: number;
    const startTime = Date.now();

    const loop = () => {
      const now = Date.now();
      const t = (now - startTime) / 1000;
      
      // Calculate Graph via Framework
      const nextState = evaluateGraph(nodes, connections, t);
      
      setGameState(nextState);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, nodes, connections]);

  // --- FRAMEWORK: Code Generation ---
  // Now delegates to engine/NodeSystem
  useEffect(() => {
    // Generate body from framework
    const bodyCode = generateCppCode(nodes, connections);
    // Wrap in template
    const fullCode = MOCK_C_PLUS_PLUS_TEMPLATE.replace('{{CODE_BODY}}', bodyCode);
    setGeneratedCode(fullCode);
  }, [nodes, connections]);

  // --- AI Handler ---
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFilePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !selectedFile) return;

    // Add User Message
    const userMsg: LogMessage = { 
      id: Date.now().toString(), 
      sender: 'user', 
      text: chatInput, 
      mediaUrl: filePreview || undefined,
      mediaType: filePreview ? 'image' : undefined,
      timestamp: new Date() 
    };
    setChatLog(prev => [...prev, userMsg]);
    
    // Clear Input immediately
    const inputSnapshot = chatInput;
    const fileSnapshot = selectedFile;
    const filePreviewSnapshot = filePreview;
    
    setChatInput('');
    setSelectedFile(null);
    setFilePreview(null);
    setIsAiLoading(true);

    try {
      let responseText = "";
      let videoUrl = undefined;

      // Handle Modes
      if (aiMode === 'veo') {
        try {
          const base64 = fileSnapshot ? await fileToBase64(fileSnapshot) : undefined;
          const mimeType = fileSnapshot?.type;
          const uri = await generateVideo(inputSnapshot, base64, mimeType);
          responseText = "Video generated successfully.";
          videoUrl = uri;
        } catch (err: any) {
          if (err.message === 'API_KEY_REQUIRED') {
            setShowKeySelector(true);
            responseText = "Please select a paid API key to use Veo.";
          } else {
            responseText = "Video generation failed. " + err.message;
          }
        }
      } 
      else if (aiMode === 'vision') {
        if (!fileSnapshot) {
          responseText = "Please upload an image for analysis.";
        } else {
          const base64 = await fileToBase64(fileSnapshot);
          responseText = await analyzeImage(inputSnapshot, base64, fileSnapshot.type);
        }
      }
      else if (aiMode === 'think') {
        responseText = await chatThinking(inputSnapshot, generatedCode);
      }
      else {
        // Fast
        responseText = await chatFast(inputSnapshot, generatedCode);
      }

      const aiMsg: LogMessage = { 
        id: (Date.now() + 1).toString(), 
        sender: 'ai', 
        text: responseText, 
        mediaUrl: videoUrl,
        mediaType: videoUrl ? 'video' : undefined,
        timestamp: new Date() 
      };
      setChatLog(prev => [...prev, aiMsg]);

    } catch (err) {
      console.error(err);
      const errorMsg: LogMessage = { id: (Date.now() + 1).toString(), sender: 'system', text: "An error occurred processing your request.", timestamp: new Date() };
      setChatLog(prev => [...prev, errorMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const openKeySelector = async () => {
    const win = window as any;
    if (win.aistudio) {
      await win.aistudio.openSelectKey();
      setShowKeySelector(false);
    }
  };

  // --- Rendering Helpers ---
  const renderConnection = (conn: Connection) => {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId);
    const toNode = nodes.find(n => n.id === conn.toNodeId);
    if (!fromNode || !toNode) return null;
    const fromSocketIndex = fromNode.outputs.findIndex(s => s.id === conn.fromSocketId);
    const toSocketIndex = toNode.inputs.findIndex(s => s.id === conn.toSocketId);
    const startX = fromNode.position.x + 150;
    const startY = fromNode.position.y + 45 + (fromSocketIndex * 24);
    const endX = toNode.position.x + 10;
    const endY = toNode.position.y + 45 + (toSocketIndex * 24);
    return (
      <path key={conn.id} d={getPath({ x: startX, y: startY }, { x: endX, y: endY })} stroke="#64748b" strokeWidth="2" fill="none" className="pointer-events-none" />
    );
  };

  const renderTempConnection = () => {
    if (!dragState.isConnecting) return null;
    return (
      <path d={getPath(dragState.startPos, dragState.currPos)} stroke="#94a3b8" strokeWidth="2" strokeDasharray="5,5" fill="none" className="pointer-events-none" />
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-200">
      
      {/* Top Bar */}
      <header className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 z-50 relative">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center font-bold">N</div>
          <span className="font-bold tracking-tight">NEBULA ENGINE</span>
          <span className="text-xs text-slate-500 ml-2">v0.9.8 Framework</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-colors ${isPlaying ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
          >
            {isPlaying ? <><Pause className="w-4 h-4"/> Stop</> : <><Play className="w-4 h-4"/> Simulate</>}
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white">
             Compile C++
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left: Node Graph (Infinite Canvas) */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-[#0f172a] overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleGraphMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ 
            backgroundPosition: `${pan.x}px ${pan.y}px`,
            backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        > 
          {/* Toolbar Overlay */}
          <div className="absolute top-4 left-4 flex gap-2 z-40">
            <button className="p-2 bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
              <Plus className="w-4 h-4 text-slate-300" />
            </button>
            <div className="px-2 py-2 bg-slate-800/80 border border-slate-700 rounded text-xs text-slate-400 font-mono">
               {Math.round(pan.x)}, {Math.round(pan.y)}
            </div>
          </div>

          {/* World Container */}
          <div 
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'top left' }} 
            className="w-full h-full relative"
          >
            <svg className="absolute inset-0 overflow-visible pointer-events-none z-0">
              {connections.map(renderConnection)}
              {renderTempConnection()}
            </svg>

            {nodes.map(node => (
              <NodeComponent
                key={node.id}
                data={node}
                isSelected={selection === node.id}
                onMouseDown={handleNodeMouseDown}
                onSocketMouseDown={handleSocketMouseDown}
              />
            ))}
          </div>
          
        </div>

        {/* Vertical Resize Handle */}
        <div 
          className="w-1.5 bg-slate-900 hover:bg-blue-600 cursor-col-resize z-50 flex flex-col justify-center items-center transition-colors shadow-lg border-l border-r border-slate-800 hover:border-blue-500"
          onMouseDown={() => setResizing('sidebar')}
        >
          <div className="h-8 w-0.5 bg-slate-600 rounded" />
        </div>

        {/* Right: Panels (Viewport + Code/AI) */}
        <div 
          className="flex flex-col bg-slate-900 shrink-0"
          style={{ width: layout.sidebarWidth }}
        >
          
          {/* Top: Viewport */}
          <div className="relative border-b border-slate-800" style={{ height: layout.viewportHeight }}>
             <Viewport gameState={gameState} />
          </div>

          {/* Horizontal Resize Handle */}
          <div 
            className="h-1.5 bg-slate-900 hover:bg-blue-600 cursor-row-resize z-50 flex justify-center items-center transition-colors shadow-lg border-t border-b border-slate-800 hover:border-blue-500"
            onMouseDown={() => setResizing('viewport')}
          >
            <div className="w-8 h-0.5 bg-slate-600 rounded" />
          </div>

          {/* Bottom: Tabs (Code / AI) */}
          <div className="flex-1 flex flex-col min-h-0">
             <div className="flex border-b border-slate-800">
               <button 
                onClick={() => setActiveTab('code')}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'code' ? 'bg-[#0d1117] text-white border-t-2 border-blue-500' : 'text-slate-500 hover:bg-slate-800'}`}
               >
                 <Code2 className="w-3 h-3" /> C++ OUTPUT
               </button>
               <button 
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'ai' ? 'bg-[#0d1117] text-white border-t-2 border-purple-500' : 'text-slate-500 hover:bg-slate-800'}`}
               >
                 <MessageSquare className="w-3 h-3" /> ASSISTANT
               </button>
             </div>

             <div className="flex-1 relative overflow-hidden bg-[#0d1117]">
               {activeTab === 'code' ? (
                 <CodePanel code={generatedCode} />
               ) : (
                 <div className="flex flex-col h-full relative">
                    {/* Mode Selector */}
                    <div className="flex items-center gap-1 p-2 bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar">
                       <button onClick={() => setAiMode('fast')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${aiMode === 'fast' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                          <Zap className="w-3 h-3" /> Flash
                       </button>
                       <button onClick={() => setAiMode('think')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${aiMode === 'think' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                          <Brain className="w-3 h-3" /> Think
                       </button>
                       <button onClick={() => setAiMode('vision')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${aiMode === 'vision' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                          <Eye className="w-3 h-3" /> Vision
                       </button>
                       <button onClick={() => setAiMode('veo')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors whitespace-nowrap ${aiMode === 'veo' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                          <Clapperboard className="w-3 h-3" /> Veo
                       </button>
                    </div>

                    {/* API Key Modal Overlay */}
                    {showKeySelector && (
                      <div className="absolute inset-0 z-50 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
                        <Key className="w-12 h-12 text-yellow-500 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Paid API Key Required</h3>
                        <p className="text-sm text-slate-400 mb-6">Veo video generation requires a paid API key from a valid Google Cloud Project.</p>
                        <div className="flex gap-3">
                           <button onClick={() => setShowKeySelector(false)} className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold">
                             Cancel
                           </button>
                           <button onClick={openKeySelector} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
                             Select Key
                           </button>
                        </div>
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="mt-4 text-[10px] text-blue-400 hover:underline">
                          View Billing Documentation
                        </a>
                      </div>
                    )}

                    {/* Chat Log */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                      {chatLog.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`flex flex-col gap-2 p-3 rounded-lg max-w-[90%] text-xs ${
                            msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                            msg.sender === 'ai' ? 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none' :
                            'bg-slate-800/50 text-slate-400 italic text-center w-full'
                          }`}>
                            {msg.mediaUrl && msg.mediaType === 'image' && (
                              <img src={msg.mediaUrl} alt="User Upload" className="max-w-full rounded border border-white/20" />
                            )}
                            {msg.mediaUrl && msg.mediaType === 'video' && (
                              <video src={msg.mediaUrl} controls className="max-w-full rounded border border-slate-600" />
                            )}
                            {msg.text && <span>{msg.text}</span>}
                          </div>
                          <span className="text-[10px] text-slate-600 mt-1 uppercase font-bold tracking-wider">
                            {msg.sender === 'ai' ? (msg.mediaType === 'video' ? 'Veo' : 'Gemini') : 'You'}
                          </span>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                      {isAiLoading && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 p-2 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> 
                          {aiMode === 'think' ? 'Thinking deeply...' : aiMode === 'veo' ? 'Generating video (this takes time)...' : 'Processing...'}
                        </div>
                      )}
                    </div>
                    
                    {/* Input */}
                    <form onSubmit={handleAiSubmit} className="p-2 border-t border-slate-800 bg-slate-900 flex flex-col gap-2">
                      {/* File Preview in Input */}
                      {filePreview && (
                        <div className="relative w-16 h-16 bg-slate-800 rounded border border-slate-700 group">
                           <img src={filePreview} className="w-full h-full object-cover rounded" alt="Preview" />
                           <button 
                             type="button" 
                             onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                             className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                           >
                             <X className="w-3 h-3" />
                           </button>
                        </div>
                      )}
                      
                      <div className="flex gap-2 items-end">
                        {(aiMode === 'vision' || aiMode === 'veo') && (
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-slate-400"
                            title="Upload Image"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleFileSelect}
                        />
                        
                        <input 
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                          placeholder={
                            aiMode === 'think' ? "Ask complex questions..." : 
                            aiMode === 'vision' ? "Ask about an image..." : 
                            aiMode === 'veo' ? "Describe the video..." : "Ask something..."
                          }
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                        />
                      </div>
                    </form>
                 </div>
               )}
             </div>
          </div>
        </div>

      </div>

      {/* Footer Status Bar */}
      <div className="h-6 bg-slate-900 border-t border-slate-800 flex items-center px-4 shrink-0 z-50 select-none">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
           <div className={`w-2 h-2 rounded-full transition-all ${dragState.isDragging || dragState.isPanning || dragState.isConnecting ? 'bg-blue-500 shadow-blue-500/50 shadow-sm' : 'bg-slate-600'}`} />
           <span className="font-mono uppercase tracking-wider">{status}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-[10px] text-slate-600 font-mono">
           <div className="flex items-center gap-1.5">
             <Activity className="w-3 h-3 text-green-900" />
             <span className="text-green-600">ENGINE ONLINE</span>
           </div>
           <span>NODES: {nodes.length}</span>
           <span>FPS: 60</span>
        </div>
      </div>

    </div>
  );
}

export default App;
