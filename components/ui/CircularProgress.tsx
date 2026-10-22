import type { ReactNode } from "react";

export function CircularProgress({
  size = 120,
  strokeWidth = 8,
  percent,
  trackClassName = "stroke-slate-800",
  progressClassName = "stroke-cyan-400",
  children,
}: {
  size?: number;
  strokeWidth?: number;
  percent: number;
  trackClassName?: string;
  progressClassName?: string;
  children?: ReactNode;
}) {
  const pct = Math.min(100, Math.max(0, percent));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const center = size / 2;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={progressClassName}
        />
      </svg>
      {children && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center"
        >
          {children}
        </div>
      )}
    </div>
  );
}
