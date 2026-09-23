import dayjs from 'dayjs';
import { motion } from 'motion/react';
import { EASE } from '../../shared';

const HOURS = Array.from({ length: 16 }, (_, i) => String(6 + i).padStart(2, '0'));

type SlotState = 'F' | 'B' | 'C' | 'S';

const COURTS: { name: string; slots: SlotState[] }[] = [
  { name: 'Cầu lông 1', slots: 'F F B B F F C C F F F F F B B F'.split(' ') as SlotState[] },
  { name: 'Cầu lông 2', slots: 'F F F B B F F F F F F F S S F F'.split(' ') as SlotState[] },
  { name: 'Tennis 1', slots: 'B B F F F F F F C C C F F F B B'.split(' ') as SlotState[] },
  { name: 'Pickleball 1', slots: 'F F F F B B F F F F F F F F F B'.split(' ') as SlotState[] },
];

export function CourtVisual() {
  return (
    <div className="lp-vis">
      <div className="lp-vis-head">
        <b>
          Đặt sân · <span style={{ textTransform: 'capitalize' }}>{dayjs().format('dddd DD/MM')}</span>
        </b>
        <span className="lp-chip green">Gói của bạn · giảm 20%</span>
      </div>

      <div className="lp-court">
        <div className="lp-court-row head">
          <span />
          {HOURS.map((h) => (
            <i key={h}>{h}</i>
          ))}
        </div>
        {COURTS.map((court, row) => (
          <div key={court.name} className="lp-court-row">
            <span>{court.name}</span>
            {court.slots.map((state, col) => (
              <motion.i
                key={col}
                className={`s-${state}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + row * 0.06 + col * 0.015, duration: 0.35, ease: EASE }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="lp-court-legend">
        <i className="s-F" /> Trống <i className="s-B" /> Đã đặt <i className="s-C" /> Lớp học <i className="s-S" />{' '}
        Đang chọn
      </div>

      <motion.div
        className="lp-vis-foot"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div>
          <small>Sân cầu lông 2 · 18:00–20:00</small>
          <b>
            <s>240.000đ</s> 192.000đ
          </b>
        </div>
        <span className="lp-btn lp-btn-primary sm">Xác nhận đặt sân</span>
      </motion.div>
    </div>
  );
}
