import { Card, Tabs } from 'antd';
import { PageHeader } from '~/components/ui/PageHeader';
import { useCurrentUser } from '~/features/auth';
import { useAddToMemberCart } from '~/features/checkout/hooks/useAddToCart';
import { useSettings } from '~/features/settings';
import { RecurringPackagePicker } from './RecurringPackagePicker';
import { SlotBookingPicker } from './SlotBookingPicker';

/** `/bookings`: pick slots or a recurring package → "Thêm vào đơn"; below, my bookings with cancel + refund. */
export function BookingsPage() {
  const user = useCurrentUser();
  const settings = useSettings();
  const add = useAddToMemberCart();
  const rules = settings.data;

  return (
    <>
      <PageHeader
        title="Đặt sân / phòng"
        description={
          rules
            ? `Chọn sân, ngày và slot ${rules.slotDurationMinutes} phút. Đặt trước tối đa ${rules.maxAdvanceBookingDays} ngày; hủy trước ${rules.bookingCancelDeadlineHours} giờ được hoàn 100% về ví.`
            : 'Chọn sân, ngày và slot rồi thêm vào đơn để thanh toán.'
        }
      />
      <div className="flex flex-col gap-4">
        <Card>
          <Tabs
            items={[
              {
                key: 'single',
                label: 'Đặt theo slot',
                children: <SlotBookingPicker user={user} onAdd={(selection) => void add(selection)} />,
              },
              {
                key: 'package',
                label: 'Gói sân định kỳ',
                children: <RecurringPackagePicker user={user} onAdd={(selection) => void add(selection)} />,
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
