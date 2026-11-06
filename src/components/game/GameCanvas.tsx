'use client';

import React, { useEffect, useRef } from 'react';
import { GameEngine } from '@/game/engine/GameEngine';

interface GameCanvasProps {
  engineRef: React.MutableRefObject<GameEngine | null>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ engineRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Pointer events for Touch / Mouse Virtual Joystick
    const handlePointerDown = (e: PointerEvent) => {
      if (!engineRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      engineRef.current.input.handlePointerDown(x, y);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!engineRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      engineRef.current.input.handlePointerMove(x, y);
    };

    const handlePointerUp = () => {
      if (!engineRef.current) return;
      engineRef.current.input.handlePointerUp();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    // Resize handler
    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.handleResize();
      }
    };
    window.addEventListener('resize', handleResize);

    // Page visibility handler (pauses loop when tab is switched)
    const handleVisibilityChange = () => {
      if (!engineRef.current) return;
      if (document.visibilityState === 'hidden') {
        engineRef.current.pause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [engineRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block touch-none select-none cursor-crosshair"
    />
  );
};
