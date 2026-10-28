import type { SaveTrainingPlanBody, TrainingPlan } from '@sports-center/shared';
import { Alert, Button, Form, Input } from 'antd';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDateTime } from '~/lib/format';
import { useSuggestPlan } from '../../hooks/useClassTraining';

interface PlanFormProps {
  classId: string;
  /** The student whose plan this is; null for the class plan. */
  accountId: string | null;
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
export function PlanForm({ classId, accountId, plan, saving, onSave }: PlanFormProps) {
  const [form] = Form.useForm<SaveTrainingPlanBody>();
  const [aiDraft, setAiDraft] = useState(false);
  const suggest = useSuggestPlan(classId, accountId);
  const confirm = useConfirm();

  const fillDraft = () =>
    suggest.mutate(undefined, {
      onSuccess: (draft) => {
        form.setFieldsValue(draft);
        setAiDraft(true);
      },
    });
  const askAi = () => {
    const { goals, content } = form.getFieldsValue();
    if (!goals?.trim() && !content?.trim()) return fillDraft();
    confirm({
      title: 'Thay nội dung đang có bằng gợi ý của AI?',
      content: 'Mục tiêu và nội dung trong ô sẽ bị thay. Kế hoạch đã lưu chỉ đổi khi bạn bấm lưu.',
      okText: 'Tạo gợi ý',
      danger: false,
      onOk: fillDraft,
    });
  };

  return (
    <Form<SaveTrainingPlanBody>
      form={form}
      layout="vertical"
      initialValues={{ goals: plan?.goals ?? '', content: plan?.content ?? '' }}
      onFinish={onSave}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13.5px] text-sc-muted">
          AI soạn nháp từ mục tiêu, sức khỏe và kết quả {accountId ? 'của học viên' : 'của cả lớp'}.
        </span>
        <Button icon={<Sparkles size={16} />} loading={suggest.isPending} onClick={askAi}>
          Gợi ý bằng AI
        </Button>
      </div>
      {aiDraft && (
        <Alert className="mb-4" type="info" showIcon title="Bản nháp do AI soạn. Hãy đọc và chỉnh sửa trước khi lưu." />
      )}
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
