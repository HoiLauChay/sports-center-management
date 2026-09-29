import { zodResolver } from '@hookform/resolvers/zod';
import {
  createFacilityBodySchema,
  ERROR_CODE,
  FACILITY_TYPES,
  type CreateFacilityBody,
  type CreateFacilityInput,
  type Facility,
  type Sport,
} from '@sports-center/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Col, Form, Input, InputNumber, Modal, Row, Segmented, Select, Switch } from 'antd';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ScheduleConflictList } from '~/components/data/ScheduleConflictList';
import { FormField, FormRootError } from '~/components/form/FormField';
import { FACILITY_TYPE_LABEL } from '~/constants/facility';
import { useFormApiError, type ErrorFieldMap } from '~/hooks/useFormApiError';
import { scheduleConflictsOf, toApiError } from '~/lib/http-errors';
import { facilitiesQueryOptions, sportsQueryOptions } from '../hooks/useCatalog';
import { facilitiesService } from '../services/facilities.service';

const ERROR_FIELDS: ErrorFieldMap = { [ERROR_CODE.NAME_TAKEN]: 'name' };

const EMPTY: CreateFacilityInput = {
  name: '',
  type: 'COURT',
  description: '',
  capacityPerSlot: 1,
  pricePerSlot: 0,
  isActive: true,
  sportIds: [],
};

const toFormValues = (facility: Facility): CreateFacilityInput => ({
  name: facility.name,
  type: facility.type,
  description: facility.description ?? '',
  capacityPerSlot: facility.capacityPerSlot,
  pricePerSlot: facility.pricePerSlot,
  isActive: facility.isActive,
  sportIds: facility.sports.map(({ id }) => id),
});

const moneyFormatter = (value: number | string | undefined) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const moneyParser = (value: string | undefined) => Number((value ?? '').replace(/\D/g, ''));

interface FacilityFormModalProps {
  open: boolean;
  facility: Facility | null;
  sports: Sport[];
  onClose: () => void;
}

export function FacilityFormModal({ open, facility, sports, onClose }: FacilityFormModalProps) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  const form = useForm<CreateFacilityInput, unknown, CreateFacilityBody>({
    resolver: zodResolver(createFacilityBodySchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  });
  const { control } = form;
  const handleApiError = useFormApiError(form, ERROR_FIELDS);

  useEffect(() => {
    if (open) form.reset(facility ? toFormValues(facility) : EMPTY);
  }, [open, facility, form]);

  const sportOptions = sports
    .filter((sport) => sport.isActive || facility?.sports.some(({ id }) => id === sport.id))
    .map((sport) => ({ value: sport.id, label: sport.name }));

  const mutation = useMutation({
    mutationFn: ({ isActive, ...values }: CreateFacilityBody) =>
      facility ? facilitiesService.update(facility.id, values) : facilitiesService.create({ ...values, isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryOptions.queryKey });
      void queryClient.invalidateQueries({ queryKey: sportsQueryOptions.queryKey });
      message.success(facility ? 'Đã cập nhật sân & phòng' : 'Đã thêm sân & phòng');
      onClose();
    },
    onError: (err) => {
      const conflicts = scheduleConflictsOf(err);
      if (!conflicts) return void handleApiError(err);
      modal.error({
        title: toApiError(err).message,
        content: <ScheduleConflictList {...conflicts} />,
        okText: 'Đã hiểu',
        width: 520,
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      open={open}
      title={facility ? 'Sửa sân & phòng' : 'Thêm sân & phòng'}
      okText="Lưu"
      cancelText="Hủy"
      width={560}
      mask={{ closable: false }}
      confirmLoading={mutation.isPending}
      onOk={() => void onSubmit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
        <FormRootError message={form.formState.errors.root?.message} />
        <FormField
          control={control}
          name="type"
          label="Loại"
          render={(field) => (
            <Segmented
              block
              value={field.value}
              onChange={field.onChange}
              options={FACILITY_TYPES.map((value) => ({ value, label: FACILITY_TYPE_LABEL[value] }))}
            />
          )}
        />
        <FormField
          control={control}
          name="name"
          label="Tên"
          render={(field, invalid) => (
            <Input
              {...field}
              status={invalid ? 'error' : undefined}
              placeholder="VD: Sân cầu lông 5"
              autoComplete="off"
            />
          )}
        />
        <FormField
          control={control}
          name="sportIds"
          label="Bộ môn"
          render={(field, invalid) => (
            <Select
              ref={field.ref}
              mode="multiple"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              status={invalid ? 'error' : undefined}
              options={sportOptions}
              placeholder="Chọn một hoặc nhiều bộ môn"
              optionFilterProp="label"
            />
          )}
        />
        <Row gutter={16}>
          <Col xs={12} sm={facility ? 12 : 9}>
            <FormField
              control={control}
              name="capacityPerSlot"
              label="Sức chứa / slot"
              render={(field, invalid) => (
                <InputNumber
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onBlur={field.onBlur}
                  status={invalid ? 'error' : undefined}
                  min={1}
                  precision={0}
                  className="!w-full"
                />
              )}
            />
          </Col>
          <Col xs={12} sm={facility ? 12 : 9}>
            <FormField
              control={control}
              name="pricePerSlot"
              label="Giá / slot"
              render={(field, invalid) => (
                <InputNumber<number>
                  ref={field.ref}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  onBlur={field.onBlur}
                  status={invalid ? 'error' : undefined}
                  min={0}
                  step={10000}
                  precision={0}
                  formatter={moneyFormatter}
                  parser={moneyParser}
                  suffix="₫"
                  className="!w-full"
                />
              )}
            />
          </Col>
          {!facility && (
            <Col xs={24} sm={6}>
              <FormField
                control={control}
                name="isActive"
                label="Nhận đặt"
                render={(field) => <Switch checked={field.value} onChange={field.onChange} />}
              />
            </Col>
          )}
        </Row>
        <FormField
          control={control}
          name="description"
          label="Mô tả"
          render={(field, invalid) => (
            <Input.TextArea
              {...field}
              value={field.value ?? ''}
              status={invalid ? 'error' : undefined}
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
          )}
        />
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
