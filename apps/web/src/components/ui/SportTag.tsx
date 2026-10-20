import { Tag } from 'antd';

export function SportTag({ name }: { name: string }) {
  return (
    <Tag color="green" className="!m-0">
      {name}
    </Tag>
  );
}
