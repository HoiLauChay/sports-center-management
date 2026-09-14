import { CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { EASE } from '../../shared';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const CLASS_DAYS = [0, 2, 4];

export function ClassVisual() {
  return (
    <div className="lp-vis">
      <div className="lp-vis-head">
        <b>🏸 Cầu lông cơ bản K3</b>
        <span className="lp-chip blue">Đang mở</span>
      </div>

      <div className="lp-cls-coach">
        <span className="lp-av" style={{ background: '#16a34a' }}>
          AD
        </span>
        <div>
          <b>Nguyễn Anh Duy</b>
          <small>HLV cầu lông cấp 1 · Pickleball</small>
        </div>
        <span className="lp-chip green">Còn 2 chỗ</span>
      </div>

      <div className="lp-cls-cap">
        <div>
          <small>Sĩ số</small>
          <b>6 / 8</b>
        </div>
        <div className="lp-bar">
          <motion.i
            initial={{ width: 0 }}
            animate={{ width: '75%' }}
            transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
          />
        </div>
      </div>

      <div className="lp-cls-sched">
        {DAYS.map((day, i) => {
          const hasClass = CLASS_DAYS.includes(i);
          return (
            <motion.div
              key={day}
              className={`lp-cls-day ${hasClass ? 'on' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            >
              <small>{day}</small>
              {hasClass && (
                <b>
                  18:00
                  <br />
                  19:30
                </b>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        className="lp-vis-note ok"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
      >
        <CheckCircle2 size={16} /> Gói All-access của bạn vào được lớp này — không tính thêm phí
      </motion.div>
    </div>
  );
}
