"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AgreementSignaturePadProps {
  onSigned: (dataUrl: string) => void;
  onCleared: () => void;
  disabled?: boolean;
}

const CANVAS_HEIGHT = 160;

export function AgreementSignaturePad({
  onSigned,
  onCleared,
  disabled,
}: AgreementSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const hasInk = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const setupContext = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "#141414";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    },
    [],
  );

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
      setupContext(ctx, width, CANVAS_HEIGHT);
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
    hasInk.current = true;
    setIsEmpty(false);
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const canvas = canvasRef.current;
    if (!canvas || !hasInk.current) return;

    onSigned(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const parent = canvas.parentElement;
    const ratio = window.devicePixelRatio || 1;
    const width = parent?.clientWidth ?? canvas.width / ratio;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    setupContext(ctx, width, CANVAS_HEIGHT);
    hasInk.current = false;
    setIsEmpty(true);
    onCleared();
  };

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
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
        <div className="border-t border-border px-4 py-2">
          <div className="mx-auto h-px max-w-[85%] bg-border" />
        </div>
      </div>
      {!isEmpty && (
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="mt-3 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
        >
          Clear signature
        </button>
      )}
    </div>
  );
}
