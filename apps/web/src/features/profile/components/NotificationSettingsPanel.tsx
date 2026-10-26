import { OPTIONAL_EMAIL_TYPES, type OptionalEmailType } from '@sports-center/shared';
import { Switch } from 'antd';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useCurrentUser } from '~/features/auth';
import { useSaveNotificationSettings } from '../hooks/useProfile';

const EMAIL_TYPE: Record<OptionalEmailType, { label: string; description: string }> = {
  MEMBERSHIP: { label: 'Gói thành viên', description: 'Sắp hết hạn, gia hạn, gói ngừng bán' },
  BOOKING: { label: 'Đặt sân', description: 'Chuyển sân do bảo trì' },
  CLASS: { label: 'Lớp học', description: 'Đổi lịch, đổi huấn luyện viên, hủy lớp' },
  TRAINING: { label: 'Tập luyện', description: 'Đánh giá và kế hoạch tập' },
  SUPPORT: { label: 'Hỗ trợ', description: 'Phản hồi yêu cầu hỗ trợ' },
};

/** Which notification types also arrive by email; they always show in the app. */
export function NotificationSettingsPanel() {
  const user = useCurrentUser();
  const save = useSaveNotificationSettings();
  const muted = save.isPending
    ? save.variables
    : OPTIONAL_EMAIL_TYPES.filter((type) => user.emailMutedTypes.includes(type));

  const toggle = (type: OptionalEmailType, on: boolean) =>
    save.mutate(on ? muted.filter((value) => value !== type) : [...muted, type]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionTitle>Nhận qua email</SectionTitle>
        <p className="m-0 text-[15px] text-sc-muted">Thông báo về thanh toán và tài khoản luôn được gửi email.</p>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {OPTIONAL_EMAIL_TYPES.map((type) => (
          <li
            key={type}
            className="flex items-center justify-between gap-4 border-t border-sc-border-soft py-3 first:border-t-0"
          >
            <div className="flex flex-col">
              <span className="font-semibold">{EMAIL_TYPE[type].label}</span>
              <span className="text-[14.5px] text-sc-muted">{EMAIL_TYPE[type].description}</span>
            </div>
            <Switch
              aria-label={`Nhận email ${EMAIL_TYPE[type].label}`}
              checked={!muted.includes(type)}
              onChange={(on) => toggle(type, on)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
