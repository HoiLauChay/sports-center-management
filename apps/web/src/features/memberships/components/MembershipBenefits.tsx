import { Check, Minus } from 'lucide-react';
import type { MembershipBenefits as Benefits } from '../types';

export function MembershipBenefits({ benefits, className = '' }: { benefits: Benefits; className?: string }) {
  const rows = [
    {
      enabled: benefits.gymAccess,
      label: benefits.gymAccess ? 'Vào gym miễn phí khi đặt slot' : 'Không bao gồm quyền vào gym miễn phí',
    },
    {
      enabled: benefits.bookingDiscountPct > 0,
      label: benefits.bookingDiscountPct
        ? `Giảm ${benefits.bookingDiscountPct}% phí đặt sân / phòng`
        : 'Không giảm phí đặt sân / phòng',
    },
    {
      enabled: benefits.classDiscountPct > 0,
      label: benefits.classDiscountPct ? `Giảm ${benefits.classDiscountPct}% học phí lớp` : 'Không giảm học phí lớp',
    },
    {
      enabled: benefits.freeBookingSlotsPerMonth > 0,
      label: benefits.freeBookingSlotsPerMonth
        ? `${benefits.freeBookingSlotsPerMonth} slot sân miễn phí mỗi tháng`
        : 'Không có slot sân miễn phí',
    },
    {
      enabled: benefits.aiQuestionsPerMonth > 0,
      label: benefits.aiQuestionsPerMonth
        ? `${benefits.aiQuestionsPerMonth} lượt hỏi trợ lý AI mỗi tháng`
        : 'Không có lượt hỏi trợ lý AI',
    },
  ].sort((a, b) => Number(b.enabled) - Number(a.enabled));

  return (
    <ul className={`m-0 grid list-none gap-x-6 gap-y-3 p-0 ${className}`}>
      {rows.map(({ enabled, label }) => (
        <li key={label} className={`flex items-start gap-2 text-[15px] ${enabled ? 'text-sc-ink' : 'text-sc-muted'}`}>
          {enabled ? (
            <Check size={17} className="mt-0.5 shrink-0 text-sc-primary" aria-hidden />
          ) : (
            <Minus size={17} className="mt-0.5 shrink-0" aria-hidden />
          )}
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
