import type { Account } from '@sports-center/shared';
import { Avatar, Button } from 'antd';
import { CalendarDays, Mail, Pencil } from 'lucide-react';
import { ImageEditButton } from '~/components/form/ImageEditButton';
import { RoleTag } from '~/components/ui/RoleTag';
import { CROP_PRESETS } from '~/constants/crop';
import { ACCOUNT_STATUS_LABEL } from '~/constants/roles';
import { formatDate, initialsOf } from '~/lib/format';
import { ROLE_COLOR } from '~/styles/antd-theme';
import { useSaveProfile } from '../hooks/useProfile';
import { getCoachProfile } from '../utils/profile';

interface ProfileHeroProps {
  user: Account;
  editing: boolean;
  onEdit: () => void;
}

export function ProfileHero({ user, editing, onEdit }: ProfileHeroProps) {
  const coach = getCoachProfile(user);
  const cover = coach?.coverImageUrl;
  const roleColor = ROLE_COLOR[user.role];
  const save = useSaveProfile();

  return (
    <section className="overflow-hidden rounded-xl border border-sc-border-soft bg-sc-surface [box-shadow:0_1px_2px_rgba(20,19,15,0.03),0_2px_10px_rgba(20,19,15,0.04)]">
      <div
        className={`group/image-edit relative aspect-[4/1] max-h-[260px] w-full overflow-hidden bg-sc-ink bg-cover bg-center max-md:aspect-[3/1] ${cover ? '' : "bg-court-pattern after:absolute after:right-12 after:-bottom-[60px] after:size-[180px] after:rounded-[50%] after:border-2 after:border-[rgba(214,242,75,0.35)] after:content-['']"}`}
        style={cover ? { backgroundImage: `url("${encodeURI(cover)}")` } : undefined}
      >
        {coach && (
          <ImageEditButton
            purpose="COVER_IMAGE"
            crop={CROP_PRESETS.cover}
            hasImage={Boolean(cover)}
            onChange={(url) => save.mutateAsync({ profile: { coverImageUrl: url } })}
            noun="ảnh bìa"
            className="top-3 right-3"
          />
        )}
      </div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4 px-6 pb-5 max-md:px-4 max-md:pb-4">
        <div className="group/image-edit relative -mt-[52px] shrink-0 rounded-[999px]">
          <Avatar
            src={user.avatarUrl ?? undefined}
            size={104}
            className="!border-4 !border-sc-surface !text-[34px] !font-bold [box-shadow:0_8px_20px_rgba(20,19,15,0.16)]"
            style={{ background: `color-mix(in srgb, ${roleColor} 14%, white)`, color: roleColor }}
          >
            {initialsOf(user.fullName)}
          </Avatar>
          <ImageEditButton
            purpose="AVATAR"
            crop={CROP_PRESETS.avatar}
            hasImage={Boolean(user.avatarUrl)}
            onChange={(url) => save.mutateAsync({ avatarUrl: url })}
            noun="ảnh đại diện"
            small
            className="right-0 bottom-0.5"
          />
        </div>
        <div className="min-w-0 flex-[1_1_260px] pt-3 max-md:pt-0">
          <h2 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold wrap-anywhere text-sc-ink uppercase max-md:text-[24px]">
            {user.fullName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-sc-muted">
            <RoleTag role={user.role} />
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[999px] bg-sc-success [box-shadow:0_0_0_3px_rgba(22,163,74,0.15)]" />
              {ACCOUNT_STATUS_LABEL[user.status]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail size={14} />
              {user.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} />
              Tham gia {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
        {!editing && (
          <Button type="primary" icon={<Pencil size={16} />} onClick={onEdit} className="max-md:w-full">
            Sửa hồ sơ
          </Button>
        )}
      </div>
    </section>
  );
}
