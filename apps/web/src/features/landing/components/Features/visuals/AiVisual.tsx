import { CheckCircle2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { VisFloat, VisHead } from './VisParts';

const PLAN = [
  { day: 'T2', text: 'Squat 4×8 @ 40kg' },
  { day: 'T4', text: 'Bench 4×6 + core' },
  { day: 'T6', text: 'Chạy interval 6×400m' },
  { day: 'CN', text: 'Yoga phục hồi 30′' },
];

export function AiVisual() {
  return (
    <div className="lp-vis-stage">
      <div className="lp-vis">
        <VisHead
          icon={Sparkles}
          title="Trợ lý AI"
          sub="Dựa trên kết quả tập của bạn"
          extra={<span className="lp-chip purple">Gym · Trung cấp</span>}
        />

        <div className="lp-chat">
          <motion.div
            className="lp-msg me"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            Tuần này mình nên tập gì để cải thiện squat?
          </motion.div>

          <motion.div
            className="lp-msg-row"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <span className="lp-msg-av">
              <Sparkles size={13} />
            </span>
            <div className="lp-msg ai">
              Dựa trên PR 40kg và RPE 7 buổi trước, mình đề xuất kế hoạch 4 buổi:
              <ul>
                {PLAN.map((item, i) => (
                  <motion.li
                    key={item.day}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + i * 0.15 }}
                  >
                    <i>{item.day}</i>
                    {item.text}
                  </motion.li>
                ))}
              </ul>
              <div className="lp-msg-actions">
                <span className="lp-btn lp-btn-primary sm">Thêm vào lịch tuần</span>
                <span className="lp-msg-ghost">Hỏi tiếp</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <VisFloat delay={1.8}>
        <span className="lp-float-icon">
          <CheckCircle2 size={16} />
        </span>
        <div>
          <small>HLV Lê Văn An</small>
          <b>Đã duyệt kế hoạch</b>
        </div>
      </VisFloat>
    </div>
  );
}
