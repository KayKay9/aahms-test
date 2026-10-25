import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-mc-line bg-mc-panel px-6 py-5 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className="mc-label">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
