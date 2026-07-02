"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  disabled?: boolean;
}

const CANVAS_HEIGHT = 180;

export function SignaturePad({ onSave, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const setupContext = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = "rgba(245, 245, 240, 0.95)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const ratio = window.devicePixelRatio || 1;
    const width = parent.clientWidth;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(CANVAS_HEIGHT * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      setupContext(ctx);
    }
  }, [setupContext]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    isDrawing.current = true;
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || disabled) return;

    e.preventDefault();

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const endDraw = () => {
    isDrawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    setIsEmpty(true);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border bg-[#0a0a0a]">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none select-none"
          style={{ touchAction: "none" }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onPointerCancel={endDraw}
          aria-label="Draw your signature"
        />
        <p className="border-t border-border px-4 py-2 text-center text-[11px] text-muted">
          Sign with your finger or mouse
        </p>
      </div>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={isEmpty || disabled}
          className="min-h-[48px] flex-1 rounded-full border border-border text-sm tracking-[0.08em] text-foreground disabled:opacity-40"
        >
          Clear signature
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isEmpty || disabled}
          className="min-h-[48px] flex-1 rounded-full bg-accent text-sm font-medium tracking-[0.08em] text-background disabled:opacity-40"
        >
          Save signature
        </button>
      </div>
    </div>
  );
}
