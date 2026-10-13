import { Spin } from 'antd';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfReceiptCanvasProps {
  blob: Blob | null;
  className?: string;
}

export function PdfReceiptCanvas({ blob, className = '' }: PdfReceiptCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    if (!blob) return;

    let cancelled = false;
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    const renderPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const arrayBuffer = await blob.arrayBuffer();
        if (cancelled) return;

        loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const numPages = pdfDoc.numPages;
        const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);
        setPages(pageNumbers);

        // Render each page once canvas elements are ready
        setTimeout(async () => {
          if (cancelled || !pdfDoc) return;

          const containerWidth = containerRef.current?.clientWidth || 800;
          const targetWidth = Math.min(Math.max(containerWidth - 48, 500), 850);
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

          for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            if (cancelled) return;
            const canvas = canvasRefs.current.get(pageNum);
            if (!canvas) continue;

            const page = await pdfDoc.getPage(pageNum);
            if (cancelled) return;

            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = targetWidth / unscaledViewport.width;
            const viewport = page.getViewport({ scale });

            canvas.width = Math.floor(viewport.width * pixelRatio);
            canvas.height = Math.floor(viewport.height * pixelRatio);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

            await page.render({
              canvasContext: ctx,
              viewport,
              canvas,
            }).promise;
          }
          if (!cancelled) setLoading(false);
        }, 50);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không thể tải hóa đơn');
          setLoading(false);
        }
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [blob]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center overflow-x-auto rounded-xl border border-sc-border-soft bg-stone-100/80 p-4 sm:p-6 ${className}`}
    >
      {loading && (
        <div className="flex flex-col items-center gap-2 py-16">
          <Spin size="large" />
          <span className="text-sm text-sc-muted">Đang vẽ hóa đơn...</span>
        </div>
      )}

      {error && (
        <div className="py-12 text-center text-sm text-sc-error">
          <span>{error}</span>
        </div>
      )}

      <div className={`flex flex-col gap-6 ${loading ? 'hidden' : ''}`}>
        {pages.map((pageNum) => (
          <div key={pageNum} className="overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-black/5">
            <canvas
              ref={(el) => {
                if (el) canvasRefs.current.set(pageNum, el);
                else canvasRefs.current.delete(pageNum);
              }}
              className="block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
