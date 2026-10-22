import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-cyan-900/40 bg-[#0d1526]/90 p-4 ${className}`}
    >
      {title && (
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-cyan-500/80">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
