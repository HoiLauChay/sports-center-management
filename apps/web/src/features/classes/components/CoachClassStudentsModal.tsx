import { Modal } from 'antd';
import { Users } from 'lucide-react';
import { EmptyState } from '~/components/feedback/States';
import type { GymClass } from '../types';

interface CoachClassStudentsModalProps {
  /** The class whose students are shown; `null` keeps the modal closed. */
  gymClass: GymClass | null;
  onClose: () => void;
}

/**
 * UC_2.21: the students of a class the coach teaches. Only the head count is known until
 * `GET /classes/{id}/enrollments` (#167) ships.
 */
export function CoachClassStudentsModal({ gymClass, onClose }: CoachClassStudentsModalProps) {
  return (
    <Modal
      open={gymClass !== null}
      onCancel={onClose}
      footer={null}
      width={720}
      title={
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-sc-primary" />
          <span>Danh sách học viên · {gymClass?.name}</span>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sc-line bg-sc-bg p-3">
          <div>
            <div className="text-xs text-sc-muted">Khóa học & Bộ môn</div>
            <div className="text-sm font-semibold text-sc-ink">
              {gymClass?.course.name} · {gymClass?.course.sport.name}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-sc-muted">Đã đăng ký: </span>
              <span className="font-bold text-sc-primary">{gymClass?.enrolledCount}</span>
              <span className="text-sc-muted"> / {gymClass?.maxStudents} học viên</span>
            </div>
            <div>
              <span className="text-sc-muted">Tối thiểu mở lớp: </span>
              <span className="font-medium">{gymClass?.minStudents}</span>
            </div>
          </div>
        </div>
        <EmptyState
          title="Chưa xem được danh sách học viên"
          description="Hệ thống chưa hỗ trợ xem tên học viên của lớp, hiện chỉ có sĩ số."
        />
      </div>
    </Modal>
  );
}
