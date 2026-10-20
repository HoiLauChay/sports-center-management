const amountFormatter = new Intl.NumberFormat('vi-VN');

export function MoneyFigure({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      {amountFormatter.format(amount)}
      <span className="font-body text-[0.55em] font-semibold opacity-55">₫</span>
    </span>
  );
}
