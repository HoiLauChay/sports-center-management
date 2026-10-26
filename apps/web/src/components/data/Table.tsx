import { Table as AntTable, type TableProps } from 'antd';
import { isValidElement, useMemo, type ReactNode } from 'react';
import { RowActions } from './RowActions';

const isBlank = (node: ReactNode) =>
  node === null ||
  node === undefined ||
  node === false ||
  node === '' ||
  (isValidElement<{ actions: unknown[] }>(node) && node.type === RowActions && node.props.actions.length === 0);

/**
 * antd `Table` sized by the browser: it never grows past its container, columns share the width by their content
 * and text wraps, so it only scrolls sideways when the cells cannot wrap any narrower. The `actions` column is
 * dropped when no row has an action.
 */
function FittedTable<T extends object>({ columns, dataSource, scroll, tableLayout = 'auto', ...props }: TableProps<T>) {
  const visible = useMemo(
    () =>
      columns?.map((column) => {
        if (column.key !== 'actions' || !('render' in column) || !column.render || !dataSource) return column;
        const render = column.render;
        const empty = dataSource.every((row, index) => isBlank(render(undefined, row, index) as ReactNode));
        return empty ? { ...column, hidden: true } : column;
      }),
    [columns, dataSource],
  );
  return (
    <AntTable<T>
      {...props}
      columns={visible}
      dataSource={dataSource}
      tableLayout={tableLayout}
      scroll={{ x: true, ...scroll }}
    />
  );
}

export const Table = Object.assign(FittedTable, { Summary: AntTable.Summary });
