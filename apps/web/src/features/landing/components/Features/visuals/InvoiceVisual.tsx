import dayjs from 'dayjs';
import { motion } from 'motion/react';

const LINES = [
  { name: 'Gói All-access 3 tháng', qty: 1, price: 1_650_000 },
  { name: 'Thuê sân cầu lông 2 (2h)', qty: 2, price: 96_000 },
];

const vnd = (n: number) => n.toLocaleString('vi-VN');

export function InvoiceVisual() {
  return (
    <div className="lp-vis lp-inv">
      <div className="lp-inv-head">
        <div>
          <b>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</b>
          <small>Mẫu số 1/001 · Ký hiệu C26TSC · Số 0001284</small>
        </div>
        <div className="lp-qr" />
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
    </div>
  );
}
