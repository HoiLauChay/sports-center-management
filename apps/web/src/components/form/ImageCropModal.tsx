import { Modal, Slider } from 'antd';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useRef, useState, type PointerEvent, type WheelEvent } from 'react';

const MAX_ZOOM = 4;
const ROUND_VIEWPORT = 300;
const RECT_VIEWPORT_MAX_WIDTH = 560;

interface Offset {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export interface CropOptions {
  title: string;
  /** Width ÷ height of the exported image, e.g. 1 for avatars, 3 for covers. */
  aspect: number;
  /** `round` dims everything outside a circle (avatars); `rect` crops the whole frame. */
  shape: 'round' | 'rect';
  /** Width of the exported image in pixels; smaller crops are not upscaled. */
  maxWidth: number;
  /**
   * Optional guide for how the image is displayed elsewhere: the aspect of the band that stays
   * visible (e.g. 4 when a 3:1 cover is shown at 4:1 on desktop).
   */
  visibleAspect?: number;
  visibleHint?: string;
  fileName: string;
}

interface ImageCropModalProps {
  /** Mount with a `key` per file so zoom and position start fresh for each image. */
  file: File;
  options: CropOptions;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}

function viewportFor({ aspect, shape }: CropOptions): Size {
  if (shape === 'round') return { width: ROUND_VIEWPORT, height: ROUND_VIEWPORT };
  // Leave room for the modal padding on phones.
  const width = Math.min(RECT_VIEWPORT_MAX_WIDTH, window.innerWidth - 64);
  return { width, height: Math.round(width / aspect) };
}

/** Keeps the image covering the whole viewport so the crop never contains empty space. */
function clampOffset(offset: Offset, image: Size, viewport: Size): Offset {
  const maxX = Math.max(0, (image.width - viewport.width) / 2);
  const maxY = Math.max(0, (image.height - viewport.height) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

async function exportCrop(
  image: HTMLImageElement,
  scale: number,
  offset: Offset,
  viewport: Size,
  { aspect, maxWidth, fileName }: CropOptions,
) {
  const sourceWidth = viewport.width / scale;
  const sourceHeight = viewport.height / scale;
  const sx = image.naturalWidth / 2 - (viewport.width / 2 + offset.x) / scale;
  const sy = image.naturalHeight / 2 - (viewport.height / 2 + offset.y) / scale;
  const outputWidth = Math.min(maxWidth, Math.round(sourceWidth));
  const outputHeight = Math.round(outputWidth / aspect);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d')!;
  // JPEG has no alpha channel, so transparent PNG areas become white instead of black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Không thể xử lý ảnh, vui lòng thử ảnh khác.');
  return new File([blob], fileName, { type: 'image/jpeg' });
}

export function ImageCropModal({ file, options, confirming, onCancel, onConfirm }: ImageCropModalProps) {
  const [viewport] = useState(() => viewportFor(options));
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const drag = useRef<{ pointerX: number; pointerY: number; start: Offset } | null>(null);

  // Callback ref with cleanup (React 19): the object URL lives exactly as long as the <img> is mounted,
  // which also covers the modal body mounting after the first render.
  const imgRef = useCallback(
    (el: HTMLImageElement | null) => {
      if (!el) return;
      const url = URL.createObjectURL(file);
      el.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [file],
  );

  // At zoom 1 the image just covers the viewport (like `object-fit: cover`).
  const scaleAt = (value: number) =>
    image ? Math.max(viewport.width / image.naturalWidth, viewport.height / image.naturalHeight) * value : 1;
  const scale = scaleAt(zoom);
  const imageSize: Size = image ? { width: image.naturalWidth * scale, height: image.naturalHeight * scale } : viewport;

  const changeZoom = (next: number) => {
    const value = Math.min(MAX_ZOOM, Math.max(1, next));
    if (!image) return setZoom(value);
    const nextScale = scaleAt(value);
    // Scale the offset too so zooming stays centred on the same point of the photo.
    const ratio = nextScale / scale;
    setZoom(value);
    setOffset((prev) =>
      clampOffset(
        { x: prev.x * ratio, y: prev.y * ratio },
        { width: image.naturalWidth * nextScale, height: image.naturalHeight * nextScale },
        viewport,
      ),
    );
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerX: e.clientX, pointerY: e.clientY, start: offset };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { pointerX, pointerY, start } = drag.current;
    setOffset(
      clampOffset({ x: start.x + e.clientX - pointerX, y: start.y + e.clientY - pointerY }, imageSize, viewport),
    );
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    changeZoom(zoom - e.deltaY * 0.002);
  };

  const handleOk = async () => {
    if (!image) return;
    setExporting(true);
    try {
      onConfirm(await exportCrop(image, scale, offset, viewport, options));
    } finally {
      setExporting(false);
    }
  };

  // Height of each band that gets cut when shown at `visibleAspect` (e.g. 12.5% for 3:1 → 4:1).
  const hiddenBand =
    options.visibleAspect && options.visibleAspect > options.aspect
      ? (1 - options.aspect / options.visibleAspect) / 2
      : 0;

  return (
    <Modal
      open
      title={options.title}
      okText="Dùng ảnh này"
      cancelText="Hủy"
      width={viewport.width + 48}
      centered
      mask={{ closable: false }}
      okButtonProps={{ disabled: !image, loading: exporting || confirming }}
      onOk={() => void handleOk()}
      onCancel={onCancel}
    >
      <p className="mt-0 mb-3 text-sm text-sc-muted">Kéo để di chuyển, cuộn chuột hoặc dùng thanh trượt để phóng to.</p>
      <div
        className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-md bg-sc-ink select-none active:cursor-grabbing"
        style={viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <img
          ref={imgRef}
          alt="Ảnh cần cắt"
          draggable={false}
          onLoad={(e) => setImage(e.currentTarget)}
          className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
          style={{
            ...imageSize,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
          }}
        />
        {options.shape === 'round' ? (
          // Everything outside the circle is dimmed, matching how the avatar is displayed.
          <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
        ) : (
          <div className="pointer-events-none absolute inset-0 rounded-md border-2 border-white/80">
            {hiddenBand > 0 && (
              <>
                <div
                  className="absolute inset-x-0 top-0 border-b border-dashed border-white/70 bg-black/35"
                  style={{ height: `${hiddenBand * 100}%` }}
                />
                <div
                  className="absolute inset-x-0 bottom-0 border-t border-dashed border-white/70 bg-black/35"
                  style={{ height: `${hiddenBand * 100}%` }}
                />
              </>
            )}
          </div>
        )}
      </div>
      {hiddenBand > 0 && options.visibleHint && (
        <p className="mt-2 mb-0 text-xs text-sc-muted">{options.visibleHint}</p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <ZoomOut size={16} className="shrink-0 text-sc-muted" />
        <Slider
          className="!my-0 flex-1"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={changeZoom}
          tooltip={{ open: false }}
        />
        <ZoomIn size={16} className="shrink-0 text-sc-muted" />
      </div>
    </Modal>
  );
}
