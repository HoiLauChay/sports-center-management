import { CalendarClock, CheckCircle2, School } from 'lucide-react';
import { motion } from 'motion/react';
import { EASE } from '../../shared';
import { VisFloat, VisHead } from './VisParts';

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const CLASS_DAYS = [0, 2, 4];
const STUDENTS = [
  { initials: 'ML', color: '#c94a1e' },
  { initials: 'TH', color: '#7c5cbf' },
  { initials: 'QN', color: '#0891b2' },
  { initials: 'PA', color: '#d9a400' },
];

export function ClassVisual() {
  return (
    <div className="lp-vis-stage">
      <div className="lp-vis">
        <VisHead
          icon={School}
          title="Cầu lông cơ bản K3"
          sub="Sân cầu lông 1 · 24 buổi"
          extra={<span className="lp-chip blue">Đang mở</span>}
        />

        <div className="lp-cls-coach">
          <span className="lp-av" style={{ background: '#0f4d34' }}>
            AD
          </span>
          <div>
            <b>Nguyễn Anh Duy</b>
            <small>HLV cầu lông cấp 1 · Pickleball</small>
          </div>
          <span className="lp-chip green">Còn 2 chỗ</span>
        </div>

        <div className="lp-cls-cap">
          <div className="lp-avs">
            {STUDENTS.map((s) => (
              <span key={s.initials} className="lp-av sm" style={{ background: s.color }}>
                {s.initials}
              </span>
            ))}
            <span className="lp-av sm more">+2</span>
          </div>
          <div className="lp-cls-cap-bar">
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

      <VisFloat delay={1}>
        <span className="lp-float-icon">
          <CalendarClock size={16} />
        </span>
        <div>
          <small>Buổi kế tiếp</small>
          <b>Thứ 2 · 18:00</b>
        </div>
      </VisFloat>
    </div>
  );
}
