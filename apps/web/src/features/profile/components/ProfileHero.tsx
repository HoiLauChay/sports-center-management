import type { Account } from '@sports-center/shared';
import { Avatar, Button } from 'antd';
import { CalendarDays, Mail, Pencil } from 'lucide-react';
import { RoleTag } from '~/components/ui/RoleTag';
import { CROP_PRESETS } from '~/constants/crop';
import { ACCOUNT_STATUS_LABEL } from '~/constants/roles';
import { formatDate, initialsOf } from '~/lib/format';
import { ROLE_COLOR } from '~/styles/antd-theme';
import { getCoachProfile } from '../utils/profile';
import { ImageEditButton } from './ImageEditButton';

interface ProfileHeroProps {
  user: Account;
  editing: boolean;
  onEdit: () => void;
}

export function ProfileHero({ user, editing, onEdit }: ProfileHeroProps) {
  const coach = getCoachProfile(user);
  const cover = coach?.coverImageUrl;
  const roleColor = ROLE_COLOR[user.role];

  return (
    <section className="sc-profile-hero">
      <div
        className={`sc-profile-cover${cover ? '' : ' is-default'}`}
        style={cover ? { backgroundImage: `url("${encodeURI(cover)}")` } : undefined}
      >
        {coach && (
          <ImageEditButton
            purpose="COVER_IMAGE"
            crop={CROP_PRESETS.cover}
            hasImage={Boolean(cover)}
            toPatch={(url) => ({ profile: { coverImageUrl: url } })}
            noun="ảnh bìa"
            className="cover"
          />
        )}
      </div>
      <div className="sc-profile-hero-body">
        <div className="sc-profile-avatar-wrap">
          <Avatar
            src={user.avatarUrl ?? undefined}
            size={104}
            className="sc-profile-avatar !text-[34px] !font-bold"
            style={{ background: `color-mix(in srgb, ${roleColor} 14%, white)`, color: roleColor }}
          >
            {initialsOf(user.fullName)}
          </Avatar>
          <ImageEditButton
            purpose="AVATAR"
            crop={CROP_PRESETS.avatar}
            hasImage={Boolean(user.avatarUrl)}
            toPatch={(url) => ({ avatarUrl: url })}
            noun="ảnh đại diện"
            className="avatar"
          />
        </div>
        <div className="sc-profile-hero-info">
          <h2 className="sc-profile-name">{user.fullName}</h2>
          <div className="sc-profile-meta">
            <RoleTag role={user.role} />
            <span className="item">
              <span className="status-dot" />
              {ACCOUNT_STATUS_LABEL[user.status]}
            </span>
            <span className="item">
              <Mail size={14} />
              {user.email}
            </span>
            <span className="item">
              <CalendarDays size={14} />
              Tham gia {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
        {!editing && (
          <Button type="primary" icon={<Pencil size={16} />} onClick={onEdit} className="sc-profile-hero-action">
            Sửa hồ sơ
          </Button>
        )}
      </div>
    </section>
  );
}
