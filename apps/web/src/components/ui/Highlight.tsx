import Highlighter from 'react-highlight-words';

export function Highlight({ children, keyword }: { children: string; keyword?: string }) {
  if (!keyword) return <>{children}</>;

  return (
    <Highlighter
      searchWords={[keyword]}
      textToHighlight={children}
      autoEscape
      highlightClassName="bg-sc-warning/15 text-sc-warning rounded-sm px-0.5"
    />
  );
}
