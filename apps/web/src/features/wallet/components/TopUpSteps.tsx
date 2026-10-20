const STEPS = [
  { title: 'Tạo hóa đơn nạp', detail: 'Chọn số tiền muốn nạp và bấm tạo hóa đơn.' },
  { title: 'Chuyển khoản', detail: 'Quét mã QR hoặc chuyển khoản đúng số tiền và nội dung trên hóa đơn.' },
  { title: 'Tiền vào ví', detail: 'Hệ thống tự cộng tiền vào ví sau khi nhận được chuyển khoản.' },
];

export function TopUpSteps() {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {STEPS.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sc-primary-soft text-[14.5px] font-bold text-sc-primary">
            {index + 1}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{step.title}</span>
            <span className="text-[14.5px] text-sc-muted">{step.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
