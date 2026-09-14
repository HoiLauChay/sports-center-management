import { Bot } from 'lucide-react';
import { motion } from 'motion/react';

const PLAN = ['T2 · Squat 4×8 @ 40kg', 'T4 · Bench 4×6 + core', 'T6 · Chạy interval 6×400m', 'CN · Yoga phục hồi 30′'];

export function AiVisual() {
  return (
    <div className="lp-vis">
      <div className="lp-vis-head">
        <b>
          <Bot size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Trợ lý AI
        </b>
        <span className="lp-chip purple">Gym · Trung cấp</span>
      </div>

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
          className="lp-msg ai"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          Dựa trên PR 40kg và RPE 7 buổi trước, mình đề xuất kế hoạch 4 buổi:
          <ul>
            {PLAN.map((item, i) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.15 }}
              >
                {item}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          className="lp-vis-note"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7 }}
        >
          HLV Lê Văn An đã duyệt · <b>Thêm vào lịch tuần</b>
        </motion.div>
      </div>
    </div>
  );
}
