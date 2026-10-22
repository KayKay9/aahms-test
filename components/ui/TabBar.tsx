export type TabItem = { id: string; label: string };

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-cyan-900/40 pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded px-3 py-1.5 text-xs font-medium transition ${
            active === tab.id
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
