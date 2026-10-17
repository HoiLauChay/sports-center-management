import { Button, Dropdown, Tooltip } from 'antd';
import { Ellipsis } from 'lucide-react';

export interface RowAction {
  key: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  hint?: string;
}

const INLINE_LIMIT = 2;

export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  if (actions.length === 0) return null;
  const inline = actions.length > INLINE_LIMIT ? actions.slice(0, 1) : actions;
  const overflow = actions.length > INLINE_LIMIT ? actions.slice(1) : [];

  return (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      {inline.map((action) => (
        <Tooltip key={action.key} title={action.disabled ? action.hint : undefined}>
          <Button
            size="small"
            type={action.primary ? 'primary' : 'default'}
            danger={action.danger}
            loading={action.loading}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </Tooltip>
      ))}
      {overflow.length > 0 && (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: overflow.map((action) => ({
              key: action.key,
              label: action.label,
              danger: action.danger,
              disabled: action.disabled,
            })),
            onClick: ({ key }) => overflow.find((action) => action.key === key)?.onClick(),
          }}
        >
          <Button size="small" icon={<Ellipsis size={14} />} aria-label={label} />
        </Dropdown>
      )}
    </div>
  );
}
