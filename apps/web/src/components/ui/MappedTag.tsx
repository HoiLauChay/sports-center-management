import { Tag } from 'antd';

export type TagMap<K extends string> = Record<K, { label: string; color?: string }>;

interface MappedTagProps<K extends string> {
  value: K;
  map: TagMap<K>;
}

/** Renders an enum value as a coloured antd `Tag` using a label/colour table. */
export function MappedTag<K extends string>({ value, map }: MappedTagProps<K>) {
  const entry = map[value];
  return (
    <Tag color={entry?.color} className="!m-0">
      {entry?.label ?? value}
    </Tag>
  );
}
