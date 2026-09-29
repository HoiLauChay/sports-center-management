import { zodResolver } from '@hookform/resolvers/zod';
import { updateSettingsBodySchema, type SystemSettings, type UpdateSettingsBody } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Form, InputNumber, Row, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type Control, type FieldPath } from 'react-hook-form';
import type { z } from 'zod';
import { ScheduleConflictList } from '~/components/data/ScheduleConflictList';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { FormField, FormRootError } from '~/components/form/FormField';
import { PageHeader } from '~/components/ui/PageHeader';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useFormApiError } from '~/hooks/useFormApiError';
import { scheduleConflictsOf, toApiError, type ScheduleConflicts } from '~/lib/http-errors';
import { settingsService } from '../services/settings.service';

type SettingsInput = z.input<typeof updateSettingsBodySchema>;
type NumberField = Exclude<FieldPath<SettingsInput>, 'openTime' | 'closeTime'>;

const settingsQueryKey = ['settings'] as const;

const toMinutes = (time: string | undefined) => {
  const [hours, minutes] = (time ?? '').split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours! * 60 + minutes! : NaN;
};

const formatMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function slotsOf(openTime?: string, closeTime?: string, slotMinutes?: number) {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (!slotMinutes || slotMinutes < 1 || !(open < close)) return [];
  const slots: string[] = [];
  for (let start = open; start + slotMinutes <= close; start += slotMinutes) slots.push(formatMinutes(start));
  return slots;
}

function TimeField({
  control,
  name,
  label,
}: {
  control: Control<SettingsInput>;
  name: 'openTime' | 'closeTime';
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      render={(field, invalid) => (
        <TimePicker
          ref={field.ref}
          value={field.value ? dayjs(field.value, 'HH:mm') : null}
          onChange={(value) => field.onChange(value ? value.format('HH:mm') : undefined)}
          onBlur={field.onBlur}
          status={invalid ? 'error' : undefined}
          format="HH:mm"
          minuteStep={5}
          needConfirm={false}
          allowClear={false}
          className="w-full"
        />
      )}
    />
  );
}

interface NumberFieldProps {
  control: Control<SettingsInput>;
  name: NumberField;
  label: string;
  unit: string;
  step?: number;
  money?: boolean;
}

function NumberInputField({ control, name, label, unit, step = 1, money }: NumberFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      render={(field, invalid) => (
        <InputNumber<number>
          ref={field.ref}
          value={field.value}
          onChange={(value) => field.onChange(value ?? undefined)}
          onBlur={field.onBlur}
          status={invalid ? 'error' : undefined}
          min={0}
          step={step}
          precision={0}
          suffix={unit}
          formatter={money ? (value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : undefined}
          parser={money ? (value) => Number((value ?? '').replace(/\D/g, '')) : undefined}
          className="!w-full"
        />
      )}
    />
  );
}

function SettingsForm({ settings }: { settings: SystemSettings }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [conflicts, setConflicts] = useState<ScheduleConflicts | null>(null);

  const form = useForm<SettingsInput, unknown, UpdateSettingsBody>({
    resolver: zodResolver(updateSettingsBodySchema),
    mode: 'onTouched',
    defaultValues: settings,
  });
  const { control } = form;
  const handleApiError = useFormApiError(form);
  const [openTime, closeTime, slotDurationMinutes] = useWatch({
    control,
    name: ['openTime', 'closeTime', 'slotDurationMinutes'],
  });
  const slots = slotsOf(openTime, closeTime, slotDurationMinutes);

  useEffect(() => form.reset(settings), [settings, form]);

  const mutation = useMutation({
    mutationFn: settingsService.update,
    onSuccess: (updated) => {
      setConflicts(null);
      queryClient.setQueryData(settingsQueryKey, updated);
      message.success('Đã lưu cấu hình');
    },
    onError: (err) => {
      const found = scheduleConflictsOf(err);
      setConflicts(found);
      if (found) form.setError('root', { message: toApiError(err).message });
      else handleApiError(err);
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={15}>
        <Card>
          <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
            {conflicts ? (
              <Alert
                type="error"
                showIcon
                className="!mb-4"
                title={form.formState.errors.root?.message}
                description={<ScheduleConflictList {...conflicts} />}
              />
            ) : (
              <FormRootError message={form.formState.errors.root?.message} />
            )}

            <SectionTitle>Giờ hoạt động</SectionTitle>
            <Row gutter={16}>
              <Col xs={12} md={8}>
                <TimeField control={control} name="openTime" label="Giờ mở cửa" />
              </Col>
              <Col xs={12} md={8}>
                <TimeField control={control} name="closeTime" label="Giờ đóng cửa" />
              </Col>
              <Col xs={24} md={8}>
                <NumberInputField
                  control={control}
                  name="slotDurationMinutes"
                  label="Thời lượng slot"
                  unit="phút"
                  step={15}
                />
              </Col>
            </Row>

            <SectionTitle>Đặt sân & khóa học</SectionTitle>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <NumberInputField control={control} name="maxAdvanceBookingDays" label="Đặt trước tối đa" unit="ngày" />
              </Col>
              <Col xs={12} md={8}>
                <NumberInputField
                  control={control}
                  name="bookingCancelDeadlineHours"
                  label="Hạn hủy booking"
                  unit="giờ"
                />
              </Col>
              <Col xs={12} md={8}>
                <NumberInputField
                  control={control}
                  name="courseCancelDeadlineDays"
                  label="Hạn hủy khóa học"
                  unit="ngày"
                />
              </Col>
            </Row>

            <SectionTitle>Gói thành viên & ví</SectionTitle>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <NumberInputField
                  control={control}
                  name="membershipExpiryWarningDays"
                  label="Nhắc gói sắp hết hạn"
                  unit="ngày"
                />
              </Col>
              <Col xs={12} md={8}>
                <NumberInputField
                  control={control}
                  name="topUpMinAmount"
                  label="Nạp ví tối thiểu"
                  unit="₫"
                  step={10000}
                  money
                />
              </Col>
              <Col xs={12} md={8}>
                <NumberInputField control={control} name="topUpExpiryMinutes" label="Hạn mã nạp ví" unit="phút" />
              </Col>
            </Row>

            <div className="flex justify-end gap-2 border-t border-sc-border-soft pt-5">
              <Button
                onClick={() => {
                  form.reset(settings);
                  setConflicts(null);
                }}
                disabled={mutation.isPending || !form.formState.isDirty}
              >
                Hoàn tác
              </Button>
              <Button type="primary" htmlType="submit" loading={mutation.isPending}>
                Lưu cấu hình
              </Button>
            </div>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={9}>
        <Card>
          <SectionTitle>Lưới slot</SectionTitle>
          <p className="mt-0 mb-3 text-sm text-sc-muted">
            {slots.length
              ? `${slots.length} slot × ${slotDurationMinutes} phút mỗi ngày`
              : 'Giờ hoạt động không hợp lệ'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <span key={slot} className="rounded-full bg-sc-paper px-2.5 py-0.5 font-mono text-xs">
                {slot}
              </span>
            ))}
          </div>
        </Card>
      </Col>
    </Row>
  );
}

export function SettingsPage() {
  const settings = useQuery({ queryKey: settingsQueryKey, queryFn: settingsService.get });

  return (
    <>
      <PageHeader title="Cấu hình hệ thống" />
      {settings.isPending ? (
        <PageLoading />
      ) : settings.isError ? (
        <Card>
          <ErrorState message={toApiError(settings.error).message} onRetry={() => void settings.refetch()} />
        </Card>
      ) : (
        <SettingsForm settings={settings.data} />
      )}
    </>
  );
}
