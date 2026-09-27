import type { Account } from '@sports-center/shared';
import { Cake, MapPin, Phone, UserRound, VenusAndMars } from 'lucide-react';
import { AccountRoleSection } from '~/components/data/AccountRoleSection';
import { InfoGrid } from '~/components/data/InfoGrid';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { GENDER_LABEL } from '~/lib/account';
import { formatDate } from '~/lib/format';

export function ProfileOverview({ user }: { user: Account }) {
  return (
    <>
      <SectionTitle>Thông tin cá nhân</SectionTitle>
      <InfoGrid
        items={[
          { label: 'Họ tên', value: user.fullName, icon: UserRound },
          { label: 'Số điện thoại', value: user.phone, icon: Phone },
          { label: 'Ngày sinh', value: user.dateOfBirth && formatDate(user.dateOfBirth), icon: Cake },
          { label: 'Giới tính', value: user.gender && GENDER_LABEL[user.gender], icon: VenusAndMars },
          { label: 'Địa chỉ', value: user.address, icon: MapPin, full: true },
        ]}
      />

      <AccountRoleSection user={user} self />
    </>
  );
}
