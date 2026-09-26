import type { Account } from '@sports-center/shared';
import {
  Award,
  BriefcaseBusiness,
  Cake,
  HeartPulse,
  MapPin,
  NotebookPen,
  Phone,
  PhoneCall,
  Target,
  UserRound,
  VenusAndMars,
} from 'lucide-react';
import { InfoGrid, type InfoItem } from '~/components/data/InfoGrid';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { formatDate } from '~/lib/format';
import { GENDER_LABEL, getCoachProfile, getMemberProfile } from '../utils/profile';

function roleSection(user: Account): { title: string; items: InfoItem[] } | null {
  const member = getMemberProfile(user);
  if (member) {
    return {
      title: 'Hồ sơ hội viên',
      items: [
        { label: 'Liên hệ khẩn cấp', value: member.emergencyContact, icon: PhoneCall, full: true },
        { label: 'Mục tiêu tập luyện', value: member.fitnessGoals, icon: Target, full: true },
        {
          label: 'Ghi chú sức khỏe · chỉ bạn, nhân viên và HLV lớp bạn học xem được',
          value: member.healthNotes,
          icon: HeartPulse,
          full: true,
        },
      ],
    };
  }

  const coach = getCoachProfile(user);
  if (coach) {
    return {
      title: 'Hồ sơ huấn luyện viên',
      items: [
        { label: 'Giới thiệu', value: coach.bio, icon: NotebookPen, full: true },
        { label: 'Kinh nghiệm', value: coach.experience, icon: BriefcaseBusiness, full: true },
        { label: 'Chứng chỉ', value: coach.certifications, icon: Award, full: true },
      ],
    };
  }

  return null;
}

export function ProfileOverview({ user }: { user: Account }) {
  const section = roleSection(user);

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

      {section && (
        <>
          <SectionTitle>{section.title}</SectionTitle>
          <InfoGrid items={section.items} />
        </>
      )}
    </>
  );
}
