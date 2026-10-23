import type { ProgressMilestone, ProgressReview, SaveProgressReviewBody } from '@sports-center/shared';
import { Button, Form, Input, Rate } from 'antd';
import { useState } from 'react';
import { formatDateTime } from '~/lib/format';
import { MILESTONE_LABEL } from '../../utils';

const CRITERIA = [
  { name: 'technique', label: 'Kỹ thuật' },
  { name: 'fitness', label: 'Thể lực' },
  { name: 'attitude', label: 'Thái độ' },
] as const;

interface ReviewCardProps {
  milestone: ProgressMilestone;
  review: ProgressReview | undefined;
  /** The class has reached this milestone, so the coach may write it. */
  reached: boolean;
  /** Undefined for read-only viewers (managers, members). */
  onSave?: (body: SaveProgressReviewBody) => Promise<unknown>;
  saving?: boolean;
}

export function ReviewScores({ review }: { review: ProgressReview }) {
  return (
    <div className="flex flex-col gap-1.5 text-[15px]">
      {CRITERIA.map(({ name, label }) => (
        <div key={name} className="flex items-center justify-between gap-3">
          <span className="text-sc-muted">{label}</span>
          <Rate disabled value={review[name]} className="!text-[16px]" />
        </div>
      ))}
      <p className="m-0 mt-1 whitespace-pre-line">{review.comment}</p>
      <span className="text-[13px] text-sc-muted">
        {review.coach.fullName} · {formatDateTime(review.updatedAt)}
      </span>
    </div>
  );
}

/** One milestone of a student's progress review (BR_4.9): shown, written when reached, edited later. */
export function ReviewCard({ milestone, review, reached, onSave, saving }: ReviewCardProps) {
  const [editing, setEditing] = useState(false);
  const title = `Đánh giá ${MILESTONE_LABEL[milestone].toLowerCase()}`;

  const body = () => {
    if (editing && onSave) {
      return (
        <Form<SaveProgressReviewBody>
          layout="vertical"
          initialValues={review ?? { comment: '' }}
          onFinish={(values) =>
            void onSave(values).then(
              () => setEditing(false),
              () => undefined,
            )
          }
        >
          {CRITERIA.map(({ name, label }) => (
            <Form.Item
              key={name}
              name={name}
              label={label}
              className="!mb-2"
              rules={[{ required: true, message: `Chấm ${label.toLowerCase()} từ 1 đến 5` }]}
            >
              <Rate />
            </Form.Item>
          ))}
          <Form.Item
            name="comment"
            label="Nhận xét"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nhận xét' }]}
          >
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              Lưu đánh giá
            </Button>
          </div>
        </Form>
      );
    }
    if (review) return <ReviewScores review={review} />;
    return (
      <span className="text-[14.5px] text-sc-muted-2">
        {reached ? 'Chưa đánh giá' : milestone === 'MID' ? 'Mở khi lớp học qua nửa số buổi' : 'Mở từ ngày buổi cuối'}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-solid border-sc-border-soft p-3">
      <div className="flex items-center justify-between gap-2">
        <b>{title}</b>
        {onSave && reached && !editing && (
          <Button size="small" type={review ? 'default' : 'primary'} onClick={() => setEditing(true)}>
            {review ? 'Sửa' : 'Đánh giá'}
          </Button>
        )}
      </div>
      {body()}
    </div>
  );
}
