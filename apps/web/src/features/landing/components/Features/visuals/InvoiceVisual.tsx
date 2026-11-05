import dayjs from 'dayjs';
import { FileDown } from 'lucide-react';
import { motion } from 'motion/react';
import { VisFloat } from './VisParts';

const LINES = [
  { name: 'Gói All-access 3 tháng', qty: 1, price: 1_650_000 },
  { name: 'Thuê sân cầu lông 2 (2h)', qty: 2, price: 96_000 },
];

const vnd = (n: number) => n.toLocaleString('vi-VN');

/** Decorative 21×21 QR-like matrix: three finder squares plus a fixed pseudo-random fill. */
const QR_SIZE = 21;
const QR_CELLS = (() => {
  const cells: [number, number][] = [];
  const inFinder = (x: number, y: number) =>
    [
      [0, 0],
      [QR_SIZE - 7, 0],
      [0, QR_SIZE - 7],
    ].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  let seed = 7;
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      seed = (seed * 9301 + 49297) % 233280;
      if (!inFinder(x, y) && seed / 233280 > 0.52) cells.push([x, y]);
    }
  }
  return cells;
})();

function QrCode() {
  return (
    <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} className="lp-qr" shapeRendering="crispEdges">
      {[
        [0, 0],
        [QR_SIZE - 7, 0],
        [0, QR_SIZE - 7],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="7" height="7" fill="#14130f" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
          <rect x={x + 2} y={y + 2} width="3" height="3" fill="#14130f" />
        </g>
      ))}
      {QR_CELLS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#14130f" />
      ))}
    </svg>
  );
}

export function InvoiceVisual() {
  return (
    <div className="lp-vis-stage">
      <div className="lp-vis lp-inv">
        <div className="lp-inv-head">
          <div>
            <b>Hóa đơn giá trị gia tăng</b>
            <small>Mẫu số 1/001 · Ký hiệu C26TSC · Số 0001284</small>
          </div>
          <QrCode />
        </div>

        <div className="lp-inv-meta">
          <span>
            Mã CQT: <b>M1-26-TSC-00001284</b>
          </span>
          <span>Ngày {dayjs().format('DD/MM/YYYY')}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nội dung</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {LINES.map((line, i) => (
              <motion.tr
                key={line.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.15 }}
              >
                <td>{line.name}</td>
                <td>{line.qty}</td>
                <td>{vnd(line.price)}</td>
                <td>{vnd(line.price * line.qty)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        <motion.div
          className="lp-inv-total"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div>
            <small>Thuế GTGT 8%</small>
            <b>147.360</b>
          </div>
          <div>
            <small>Tổng thanh toán</small>
            <b className="big">1.989.360đ</b>
          </div>
        </motion.div>

        <motion.div
          className="lp-inv-words"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          Bằng chữ: <i>Một triệu chín trăm tám mươi chín nghìn ba trăm sáu mươi đồng</i>
        </motion.div>

        <motion.span
          className="lp-inv-stamp"
          initial={{ opacity: 0, scale: 1.6, rotate: -14 }}
          animate={{ opacity: 1, scale: 1, rotate: -10 }}
          transition={{ delay: 1.1, duration: 0.35 }}
        >
          Đã thanh toán
        </motion.span>
      </div>

      <VisFloat delay={1.4}>
        <span className="lp-float-icon">
          <FileDown size={16} />
        </span>
        <div>
          <small>Hóa đơn điện tử</small>
          <b>Tải PDF · In hóa đơn</b>
        </div>
      </VisFloat>
    </div>
  );
}
