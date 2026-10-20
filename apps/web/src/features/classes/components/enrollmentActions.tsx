import type { MyEnrollment } from '@sports-center/shared';
import { enrollmentRefund } from '~/features/checkout/refundPolicy';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDate, formatVND } from '~/lib/format';
import { todayVN } from '~/lib/time';
import { useCancelEnrollment } from '../hooks/useClasses';

export function enrollmentProgress(enrollment: MyEnrollment) {
  const { startDate } = enrollment.class;
  if (startDate && todayVN() < startDate) return `Khai giảng ${formatDate(startDate)}`;
  return enrollment.sessionsLeft > 0 ? `Còn ${enrollment.sessionsLeft} buổi` : 'Đã học hết các buổi';
}

export function useAskCancelEnrollment() {
  const confirm = useConfirm();
  const cancel = useCancelEnrollment();

  const ask = (enrollment: MyEnrollment) => {
    const refund = enrollmentRefund(enrollment);
    confirm({
      title: `Hủy đăng ký lớp ${enrollment.class.name}?`,
      content: (
        <div className="flex flex-col gap-2">
          <span>Khai giảng {formatDate(enrollment.class.startDate!)}.</span>
          <span className="font-semibold text-sc-success">
            {refund > 0
              ? `Bạn sẽ được hoàn ${formatVND(refund)} về ví.`
              : 'Lớp này không có khoản thanh toán nên không có tiền hoàn.'}
          </span>
        </div>
      ),
      okText: refund > 0 ? `Hủy và nhận ${formatVND(refund)}` : 'Hủy đăng ký',
      onOk: () => cancel.mutateAsync(enrollment.id).catch(() => undefined),
    });
  };

  return { ask, cancel };
}
