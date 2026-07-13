export interface ContextItem {
  key: string;
  label: string;
}

export function ContextNav({
  items,
  active,
  onSelect,
}: {
  items: ContextItem[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <aside className="ctxnav">
      {items.map((i) => (
        <button
          key={i.key}
          className={`ctxnav-item ${active === i.key ? 'ctxnav-active' : ''}`}
          onClick={() => onSelect(i.key)}
        >
          {i.label}
        </button>
      ))}
    </aside>
  );
}
