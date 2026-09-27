import type { Account } from '@sports-center/shared';
import { Award, BriefcaseBusiness, HeartPulse, NotebookPen, PhoneCall, StickyNote, Target } from 'lucide-react';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { getCoachProfile, getMemberProfile, getStaffProfile } from '~/lib/account';
import { InfoGrid, type InfoItem } from './InfoGrid';

function roleSection(user: Account, self: boolean): { title: string; items: InfoItem[] } | null {
  const member = getMemberProfile(user);
  if (member) {
    return {
      title: 'Hồ sơ hội viên',
      items: [
        { label: 'Liên hệ khẩn cấp', value: member.emergencyContact, icon: PhoneCall, full: true },
        { label: 'Mục tiêu tập luyện', value: member.fitnessGoals, icon: Target, full: true },
        {
          label: self ? 'Ghi chú sức khỏe · chỉ bạn, nhân viên và HLV lớp bạn học xem được' : 'Ghi chú sức khỏe',
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

  const staff = self ? null : getStaffProfile(user);
  if (staff) {
    return {
      title: 'Hồ sơ nhân sự',
      items: [{ label: 'Ghi chú nhân sự', value: staff.staffNotes, icon: StickyNote, full: true }],
    };
  }

  return null;
}

export function AccountRoleSection({ user, self = false }: { user: Account; self?: boolean }) {
  const section = roleSection(user, self);
  if (!section) return null;

  return (
    <div className="mt-8">
      <SectionTitle>{section.title}</SectionTitle>
      <InfoGrid items={section.items} />
    </div>
  );
}
