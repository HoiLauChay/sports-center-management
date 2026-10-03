import { useEffect, useRef, useState } from 'react';
import { formatVND } from '~/lib/format';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartDatum {
  label: string;
  values: Record<string, number>;
}

interface BarChartProps {
  data: ChartDatum[];
  series: ChartSeries[];
  mode?: 'stacked' | 'grouped';
  height?: number;
  /** Formats the y axis and tooltip values; defaults to VND. */
  format?: (value: number) => string;
  ariaLabel: string;
}

const PAD = { top: 12, right: 12, bottom: 28, left: 56 };

function compact(value: number) {
  if (value >= 1e9) return `${+(value / 1e9).toFixed(1)} tỷ`;
  if (value >= 1e6) return `${+(value / 1e6).toFixed(1)} tr`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}k`;
  return String(value);
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * exponent;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(element);
    setWidth(Math.max(280, element.clientWidth));
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Dependency-free SVG bar chart: stacked or grouped series over labelled categories, with legend and tooltip. */
export function BarChart({
  data,
  series,
  mode = 'stacked',
  height = 300,
  format = formatVND,
  ariaLabel,
}: BarChartProps) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const inner = { width: width - PAD.left - PAD.right, height: height - PAD.top - PAD.bottom };

  const totals = data.map((datum) =>
    mode === 'stacked'
      ? series.reduce((sum, item) => sum + (datum.values[item.key] ?? 0), 0)
      : Math.max(0, ...series.map((item) => datum.values[item.key] ?? 0)),
  );
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => max * ratio);
  const slot = inner.width / Math.max(1, data.length);
  const barWidth = Math.max(2, Math.min(40, slot * 0.7));
  const labelEvery = Math.ceil(36 / slot);
  const y = (value: number) => PAD.top + inner.height - (value / max) * inner.height;

  return (
    <div ref={ref} className="relative w-full">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-sc-muted">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--sc-border-soft)"
              strokeDasharray={tick ? '4 4' : undefined}
            />
            <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="var(--sc-muted)">
              {compact(tick)}
            </text>
          </g>
        ))}
        {data.map((datum, index) => {
          const x0 = PAD.left + slot * index + (slot - barWidth) / 2;
          let stack = 0;
          return (
            <g key={`${datum.label}-${index}`} onMouseEnter={() => setHover(index)}>
              <rect x={PAD.left + slot * index} y={PAD.top} width={slot} height={inner.height} fill="transparent" />
              {series.map((item, seriesIndex) => {
                const value = datum.values[item.key] ?? 0;
                if (value <= 0) return null;
                if (mode === 'stacked') {
                  const top = y(stack + value);
                  const bar = (
                    <rect
                      key={item.key}
                      x={x0}
                      y={top}
                      width={barWidth}
                      height={Math.max(0, y(stack) - top)}
                      fill={item.color}
                      opacity={hover === null || hover === index ? 1 : 0.45}
                    />
                  );
                  stack += value;
                  return bar;
                }
                const groupWidth = barWidth / series.length;
                return (
                  <rect
                    key={item.key}
                    x={x0 + groupWidth * seriesIndex}
                    y={y(value)}
                    width={Math.max(1, groupWidth - 1)}
                    height={Math.max(0, y(0) - y(value))}
                    fill={item.color}
                    opacity={hover === null || hover === index ? 1 : 0.45}
                  />
                );
              })}
              {index % labelEvery === 0 && (
                <text
                  x={PAD.left + slot * index + slot / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--sc-muted)"
                >
                  {datum.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute z-10 min-w-44 rounded-lg border border-sc-border bg-white px-3 py-2 text-[12.5px] shadow-lg"
          style={{
            top: 30,
            left: Math.min(width - 190, Math.max(0, PAD.left + slot * hover + slot / 2 - 90)),
          }}
        >
          <div className="mb-1 font-semibold">{data[hover].label}</div>
          {series.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block size-2 rounded-sm" style={{ background: item.color }} />
                {item.label}
              </span>
              <b className="tabular-nums">{format(data[hover]!.values[item.key] ?? 0)}</b>
            </div>
          ))}
          {mode === 'stacked' && (
            <div className="mt-1 flex justify-between gap-4 border-t border-sc-border-soft pt-1">
              <span>Tổng</span>
              <b className="tabular-nums">{format(totals[hover] ?? 0)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
