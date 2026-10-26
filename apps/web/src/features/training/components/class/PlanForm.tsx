import type { SaveTrainingPlanBody, TrainingPlan } from '@sports-center/shared';
import { Button, Form, Input } from 'antd';
import { formatDateTime } from '~/lib/format';

interface PlanFormProps {
  plan: TrainingPlan | null;
  saving: boolean;
  onSave: (body: SaveTrainingPlanBody) => void;
}

export function PlanMeta({ plan }: { plan: TrainingPlan | null }) {
  return plan ? (
    <span className="text-[13.5px] text-sc-muted">
      Cập nhật bởi {plan.updatedBy.fullName} · {formatDateTime(plan.updatedAt)}
    </span>
  ) : (
    <span className="text-[13.5px] text-sc-muted-2">Chưa có kế hoạch</span>
  );
}

/** Goals and content of a training plan (BR_4.8); re-mounted with a new key whenever the saved plan changes. */
export function PlanForm({ plan, saving, onSave }: PlanFormProps) {
  return (
    <Form<SaveTrainingPlanBody>
      layout="vertical"
      initialValues={{ goals: plan?.goals ?? '', content: plan?.content ?? '' }}
      onFinish={onSave}
    >
      <Form.Item
        name="goals"
        label="Mục tiêu"
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập mục tiêu' }]}
      >
        <Input.TextArea rows={3} maxLength={1000} showCount />
      </Form.Item>
      <Form.Item
        name="content"
        label="Nội dung và bài tập"
        rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nội dung' }]}
      >
        <Input.TextArea rows={8} maxLength={5000} showCount />
      </Form.Item>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlanMeta plan={plan} />
        <Button type="primary" htmlType="submit" loading={saving}>
          {plan ? 'Cập nhật kế hoạch' : 'Lưu kế hoạch'}
        </Button>
      </div>
    </Form>
  );
}

/** A saved plan shown read-only, for managers and members. */
export function PlanView({ plan }: { plan: TrainingPlan | null }) {
  if (!plan) return <span className="text-sc-muted-2">Chưa có kế hoạch</span>;
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div>
        <div className="text-[13.5px] font-medium text-sc-muted">Mục tiêu</div>
        <div className="whitespace-pre-line">{plan.goals}</div>
      </div>
      <div>
        <div className="text-[13.5px] font-medium text-sc-muted">Nội dung và bài tập</div>
        <div className="whitespace-pre-line">{plan.content}</div>
      </div>
      <PlanMeta plan={plan} />
    </div>
  );
}
