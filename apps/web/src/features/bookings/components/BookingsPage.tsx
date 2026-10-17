import { Card, Tabs } from 'antd';
import { PageHeader } from '~/components/ui/PageHeader';
import { useCurrentUser } from '~/features/auth';
import { useAddToMemberCart } from '~/features/checkout/hooks/useAddToCart';
import { MyBookings } from './MyBookings';
import { RecurringPackagePicker } from './RecurringPackagePicker';
import { SlotBookingPicker } from './SlotBookingPicker';

/** `/bookings`: pick slots or a recurring package → "Thêm vào đơn"; below, my bookings with cancel + refund. */
export function BookingsPage() {
  const user = useCurrentUser();
  const add = useAddToMemberCart();

  return (
    <>
      <PageHeader title="Đặt sân / phòng" />
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
        <Card title="Lịch đặt của tôi">
          <MyBookings />
        </Card>
      </div>
    </>
  );
}
