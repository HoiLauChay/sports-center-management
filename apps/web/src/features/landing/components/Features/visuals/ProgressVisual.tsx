import { TrendingUp, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { EASE } from '../../shared';
import { VisFloat, VisHead } from './VisParts';

/** Squat weight (kg) per week. */
const WEEKS = [30, 31.5, 32.5, 34, 35, 35.5, 37.5, 40];
const Y_MIN = 28;
const Y_MAX = 42;

const W = 320;
const H = 130;
const PAD = { left: 30, right: 14, top: 12, bottom: 22 };
const toX = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (WEEKS.length - 1);
const toY = (kg: number) => PAD.top + ((Y_MAX - kg) * (H - PAD.top - PAD.bottom)) / (Y_MAX - Y_MIN);
const POINTS = WEEKS.map((kg, i) => [toX(i), toY(kg)] as const);

/** Catmull-Rom through every point, as cubic Béziers, so the line reads as a smooth trend. */
function smoothPath(points: readonly (readonly [number, number])[]) {
  return points.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [x0, y0] = points[i - 2] ?? points[i - 1];
    const [x1, y1] = points[i - 1];
    const [x3, y3] = points[i + 1] ?? [x, y];
    const c1 = [x1 + (x - x0) / 6, y1 + (y - y0) / 6];
    const c2 = [x - (x3 - x1) / 6, y - (y3 - y1) / 6];
    return `${d} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${x} ${y}`;
  }, '');
}

const LINE_PATH = smoothPath(POINTS);
const AREA_PATH = `${LINE_PATH} L ${toX(WEEKS.length - 1)} ${H - PAD.bottom} L ${PAD.left} ${H - PAD.bottom} Z`;
const [LAST_X, LAST_Y] = POINTS[POINTS.length - 1];

const METRICS = [
  { name: 'Squat', value: '40 kg', delta: '+2.5' },
  { name: 'Plank', value: '80 s', delta: '+10' },
  { name: 'Chạy 3km', value: '17.8′', delta: '−0.4' },
  { name: 'RPE', value: '7 / 10', delta: '' },
];

export function ProgressVisual() {
  return (
    <div className="lp-vis-stage">
      <div className="lp-vis">
        <VisHead
          icon={TrendingUp}
          title="Tiến độ"
          sub="Nguyễn Văn Dũng · Squat 8 tuần"
          extra={<span className="lp-chip green">+33%</span>}
        />

        <svg viewBox={`0 0 ${W} ${H}`} className="lp-chart">
          <defs>
            <linearGradient id="lp-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#0f4d34" stopOpacity=".28" />
              <stop offset="1" stopColor="#0f4d34" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[30, 35, 40].map((kg) => (
            <g key={kg}>
              <line x1={PAD.left} x2={W - PAD.right} y1={toY(kg)} y2={toY(kg)} stroke="#ece8df" strokeDasharray="3 4" />
              <text x={PAD.left - 8} y={toY(kg) + 3} textAnchor="end" className="lp-chart-y">
                {kg}
              </text>
            </g>
          ))}
          {WEEKS.map((_, i) => (
            <text key={i} x={toX(i)} y={H - 6} textAnchor="middle" className="lp-chart-x">
              T{i + 1}
            </text>
          ))}
          <motion.path
            d={AREA_PATH}
            fill="url(#lp-chart-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          />
          <motion.path
            d={LINE_PATH}
            fill="none"
            stroke="#0f4d34"
            strokeWidth="2.6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.3, ease: EASE, delay: 0.2 }}
          />
          {POINTS.slice(0, -1).map(([x, y], i) => (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill="#fff"
              stroke="#0f4d34"
              strokeWidth="2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.13 }}
            />
          ))}
          <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.3 }}>
            <circle cx={LAST_X} cy={LAST_Y} r="9" fill="#d6f24b" opacity=".55" className="lp-chart-halo" />
            <circle cx={LAST_X} cy={LAST_Y} r="4.5" fill="#0f4d34" stroke="#fff" strokeWidth="2" />
          </motion.g>
        </svg>

        <div className="lp-metrics">
          {METRICS.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.08 }}
            >
              <small>{m.name}</small>
              <b>{m.value}</b>
              {m.delta && <em>{m.delta}</em>}
            </motion.div>
          ))}
        </div>
      </div>

      <VisFloat delay={1.4}>
        <span className="lp-float-icon orange">
          <Trophy size={16} />
        </span>
        <div>
          <small>Kỷ lục mới</small>
          <b>Squat 40 kg</b>
        </div>
      </VisFloat>
    </div>
  );
}
