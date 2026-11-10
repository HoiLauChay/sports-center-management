import { getRouteApi } from '@tanstack/react-router';
import { Avatar, Card, Tag } from 'antd';
import { Award, BriefcaseBusiness, CheckCircle2, NotebookPen } from 'lucide-react';
import { InfoGrid } from '~/components/data/InfoGrid';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { RoleTag } from '~/components/ui/RoleTag';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useClasses } from '~/features/classes';
import { ClassCard } from '~/features/classes/components/ClassCard';
import { useMyMemberships } from '~/features/memberships/hooks/useMyMemberships';
import { initialsOf } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { ROLE_COLOR } from '~/styles/antd-theme';
import { useCoachProfile } from '../hooks/useCoaches';

const routeApi = getRouteApi('/_authenticated/_member/coaches/$coachId');

const CLASS_LIMIT = 6;

/** `/coaches/{id}`: who teaches a class, what they are approved for and which of their classes take students now. */
export function CoachProfilePage() {
  const { coachId } = routeApi.useParams();
  const profile = useCoachProfile(coachId);
  const classes = useClasses({ page: 1, limit: CLASS_LIMIT, coachId });
  const discountPct = useMyMemberships().query.data?.current?.currentBenefits?.classDiscountPct ?? 0;

  if (profile.isPending) return <PageLoading />;
  if (profile.isError) {
    const apiError = toApiError(profile.error);
    return (
      <ErrorState
        message={apiError.status === 404 ? 'Không tìm thấy huấn luyện viên.' : apiError.message}
        onRetry={apiError.status === 404 ? undefined : () => void profile.refetch()}
      />
    );
  }
  const coach = profile.data;
  const cover = coach.coverImageUrl;
  const roleColor = ROLE_COLOR.COACH;

  return (
    <>
      <PageHeader title="Hồ sơ huấn luyện viên" back={{ to: '/classes', label: 'Lớp học' }} />

      <section className="mb-4 overflow-hidden rounded-xl border border-sc-border-soft bg-sc-surface">
        <div
          className={`relative w-full overflow-hidden bg-sc-ink bg-cover bg-center aspect-[4/1] max-h-[220px] max-md:aspect-[3/1] ${cover ? '' : 'bg-court-pattern'}`}
          style={cover ? { backgroundImage: `url("${encodeURI(cover)}")` } : undefined}
        />
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-6 pb-5 max-md:px-4 max-md:pb-4">
          <div className="-mt-[52px] shrink-0 rounded-[999px]">
            <Avatar
              src={coach.avatarUrl ?? undefined}
              size={104}
              className="!border-4 !border-sc-surface !text-[34px] !font-bold [box-shadow:0_8px_20px_rgba(20,19,15,0.16)]"
              style={{ background: `color-mix(in srgb, ${roleColor} 14%, white)`, color: roleColor }}
            >
              {initialsOf(coach.fullName)}
            </Avatar>
          </div>
          <div className="min-w-0 flex-[1_1_240px]">
            <h2 className="m-0 font-display text-[30px] leading-[1.05] font-extrabold wrap-anywhere text-sc-ink uppercase max-md:text-[24px]">
              {coach.fullName}
            </h2>
            <div className="mt-2">
              <RoleTag role="COACH" />
            </div>
          </div>
        </div>
      </section>

      <Card className="!mb-4">
        <SectionTitle>Bộ môn giảng dạy</SectionTitle>
        {coach.sports.length === 0 ? (
          <p className="m-0 text-[15px] text-sc-muted-2">Chưa có bộ môn được duyệt</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {coach.sports.map((sport) => (
              <Tag
                key={sport.id}
                color="success"
                icon={<CheckCircle2 size={14} />}
                className="!m-0 inline-flex items-center gap-1.5 !px-3 !py-1 !text-[14.5px] font-semibold"
              >
                {sport.name}
                {sport.experienceYears !== null && <span className="font-normal"> · {sport.experienceYears} năm</span>}
              </Tag>
            ))}
          </div>
        )}
        <div className="mt-6">
          <SectionTitle>Thông tin chuyên môn</SectionTitle>
          <InfoGrid
            single
            items={[
              { label: 'Giới thiệu', value: coach.bio, icon: NotebookPen },
              { label: 'Kinh nghiệm', value: coach.experience, icon: BriefcaseBusiness },
              { label: 'Chứng chỉ', value: coach.certifications, icon: Award },
            ]}
          />
        </div>
      </Card>

      <SectionTitle>Lớp đang nhận đăng ký</SectionTitle>
      {classes.isPending ? (
        <PageLoading />
      ) : classes.isError ? (
        <Card>
          <ErrorState message={toApiError(classes.error).message} onRetry={() => void classes.refetch()} />
        </Card>
      ) : classes.data.items.length === 0 ? (
        <Card>
          <EmptyState title="Huấn luyện viên chưa có lớp nào đang nhận đăng ký" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {classes.data.items.map((item) => (
            <ClassCard key={item.id} item={item} discountPct={discountPct} />
          ))}
        </div>
      )}
    </>
  );
}
