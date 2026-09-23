import { motion } from 'motion/react';
import { EASE } from '../../shared';

const POINTS: [number, number][] = [
  [0, 70],
  [1, 62],
  [2, 58],
  [3, 50],
  [4, 44],
  [5, 40],
  [6, 30],
  [7, 22],
];
const X_START = 20;
const X_STEP = 40;
const toX = (x: number) => X_START + x * X_STEP;

const LINE_PATH = POINTS.map(([x, y], i) => `${i ? 'L' : 'M'} ${toX(x)} ${y}`).join(' ');
const AREA_PATH = `${LINE_PATH} L ${toX(7)} 90 L ${X_START} 90 Z`;

const METRICS = [
  { name: 'Squat', value: '40 kg', delta: '+2.5' },
  { name: 'Plank', value: '80 s', delta: '+10' },
  { name: 'Chạy 3km', value: '17.8 phút', delta: '−0.4' },
  { name: 'RPE', value: '7 / 10', delta: '' },
];

export function ProgressVisual() {
  return (
    <div className="lp-vis">
      <div className="lp-vis-head">
        <b>Tiến độ · Nguyễn Văn Dũng</b>
        <span className="lp-chip orange">🏆 PR mới: Squat 40kg</span>
      </div>

      <svg viewBox="0 0 320 90" className="lp-chart">
        <defs>
          <linearGradient id="lp-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0f4d34" stopOpacity=".35" />
            <stop offset="1" stopColor="#0f4d34" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 40, 60].map((y) => (
          <line key={y} x1="10" x2="310" y1={y} y2={y} stroke="#e6eaf2" strokeDasharray="3 3" />
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
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.3, ease: EASE, delay: 0.2 }}
        />
        {POINTS.map(([x, y], i) => (
          <motion.circle
            key={i}
            cx={toX(x)}
            cy={y}
            r="4"
            fill="#fff"
            stroke="#0f4d34"
            strokeWidth="2.5"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.15 }}
          />
        ))}
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
  );
}
