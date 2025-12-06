
import React, { useEffect, useRef } from 'react';
import { GameState } from '../types';

interface ViewportProps {
  gameState: GameState;
}

export const Viewport: React.FC<ViewportProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0f172a'; // Match bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (World Space)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const gridSize = 40;

    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw "Player" Cube
    const size = 50;
    // Map gameState position (logical) to screen
    // Logic: Y up is positive, X right is positive. 0,0 is center.
    // Factor: 1 unit = 20 pixels
    const renderX = centerX + (gameState.cubePosition.x * 20) - (size / 2);
    const renderY = centerY - (gameState.cubePosition.y * 20) - (size / 2); // Invert Y for canvas

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(renderX + size/2, renderY + size + 10, size/2, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cube
    ctx.fillStyle = gameState.cubeColor || '#3b82f6';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    
    // Draw rounded rect
    ctx.beginPath();
    ctx.roundRect(renderX, renderY, size, size, 8);
    ctx.fill();
    ctx.stroke();

    // Stylized "face"
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(renderX + size*0.3, renderY + size*0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(renderX + size*0.7, renderY + size*0.3, 5, 0, Math.PI * 2);
    ctx.fill();

    // Stats
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`POS: ${gameState.cubePosition.x.toFixed(2)}, ${gameState.cubePosition.y.toFixed(2)}`, 10, canvas.height - 25);
    ctx.fillText(`TIME: ${gameState.time.toFixed(2)}s`, 10, canvas.height - 10);

  }, [gameState]);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-slate-400 font-mono pointer-events-none">
        GAME VIEWPORT
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
