/**
 * ImageCropper — canvas-based circular crop UI, zero external dependencies.
 *
 * Usage:
 *   <ImageCropper
 *     src={objectURL}
 *     onCrop={(blob) => upload(blob)}
 *     onCancel={() => setSrc(null)}
 *   />
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Check, X } from 'lucide-react';
import { Button } from './Button';

interface Props {
  src: string;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  size?: number;   // output px (default 300)
}

export function ImageCropper({ src, onCrop, onCancel, size = 300 }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef     = useRef<HTMLImageElement | null>(null);

  // Crop state
  const [zoom,     setZoom]     = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset,   setOffset]   = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart  = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; draw(); };
    img.src = src;
  }, [src]);

  // Redraw whenever state changes
  useEffect(() => { draw(); }, [zoom, rotation, offset]);

  const CANVAS = size;
  const RADIUS = CANVAS / 2;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS, CANVAS);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(RADIUS, RADIUS, RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // Draw image centered + zoomed + rotated + offset
    ctx.translate(RADIUS + offset.x, RADIUS + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const scale = Math.max(CANVAS / img.width, CANVAS / img.height);
    const w = img.width  * scale;
    const h = img.height * scale;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    ctx.restore();

    // Circle border
    ctx.beginPath();
    ctx.arc(RADIUS, RADIUS, RADIUS - 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth   = 3;
    ctx.stroke();
  }, [zoom, rotation, offset, CANVAS, RADIUS]);

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (e.clientY - dragStart.current.my),
    });
  };
  const onMouseUp = () => setDragging(false);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mx: t.clientX, my: t.clientY, ox: offset.x, oy: offset.y };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({
      x: dragStart.current.ox + (t.clientX - dragStart.current.mx),
      y: dragStart.current.oy + (t.clientY - dragStart.current.my),
    });
  };

  // Export cropped blob
  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm text-gray-500 text-center">
        Drag to reposition · Scroll or use buttons to zoom
      </p>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS}
        height={CANVAS}
        className="rounded-full cursor-grab active:cursor-grabbing touch-none"
        style={{ width: CANVAS, height: CANVAS }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onMouseUp}
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z) => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001)));
        }}
      />

      {/* Controls */}
      <div className="flex items-center gap-3 w-full px-2">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-colors shrink-0"
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>

        <input
          type="range" min={50} max={400} step={5}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
          className="flex-1 accent-orange-500 cursor-pointer"
        />

        <button
          onClick={() => setZoom((z) => Math.min(4, z + 0.1))}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-colors shrink-0"
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>

        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white transition-colors shrink-0"
          title="Rotate 90°"
        >
          <RotateCw size={16} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 w-full">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          <X size={15} /> Cancel
        </Button>
        <Button onClick={handleCrop} className="flex-1">
          <Check size={15} /> Apply Crop
        </Button>
      </div>
    </div>
  );
}
