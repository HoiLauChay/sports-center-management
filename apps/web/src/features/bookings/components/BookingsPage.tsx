import { Card, Tabs } from 'antd';
import { PageHeader } from '~/components/ui/PageHeader';
import { useCurrentUser } from '~/features/auth';
import { useAddToMemberCart } from '~/features/checkout/hooks/useAddToCart';
import { MyBookings } from './MyBookings';
import { RecurringPackagePicker } from './RecurringPackagePicker';
import { SlotBookingPicker } from './SlotBookingPicker';

export function BookingsPage() {
  const user = useCurrentUser();
  const add = useAddToMemberCart();

  return (
    <>
      <PageHeader title="Đặt sân / phòng" />
      <Tabs
        items={[
          {
            key: 'book',
            label: 'Đặt mới',
            children: (
              <Card>
                <Tabs
                  size="small"
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
            ),
          },
          {
            key: 'mine',
            label: 'Lịch đặt của tôi',
            children: (
              <Card>
                <MyBookings />
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
