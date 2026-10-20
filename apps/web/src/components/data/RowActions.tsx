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

export function RowActions({
  label,
  actions,
  inlineLimit = INLINE_LIMIT,
}: {
  label: string;
  actions: RowAction[];
  inlineLimit?: number;
}) {
  if (actions.length === 0) return null;
  const collapse = actions.length > inlineLimit;
  const inline = collapse ? actions.slice(0, Math.min(1, inlineLimit)) : actions;
  const overflow = collapse ? actions.slice(inline.length) : [];

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
