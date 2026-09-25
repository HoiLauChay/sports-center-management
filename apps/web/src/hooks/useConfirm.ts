import { App } from 'antd';
import { useCallback, type ReactNode } from 'react';

interface ConfirmOptions {
  title: ReactNode;
  content?: ReactNode;
  okText?: string;
  danger?: boolean;
  onOk: () => unknown;
}

export function useConfirm() {
  const { modal } = App.useApp();

  return useCallback(
    ({ title, content, okText = 'Xác nhận', danger = true, onOk }: ConfirmOptions) =>
      modal.confirm({
        title,
        content,
        okText,
        cancelText: 'Hủy',
        centered: true,
        okButtonProps: { danger },
        onOk,
      }),
    [modal],
  );
}
