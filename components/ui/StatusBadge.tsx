"use client";

type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "violet"
  | "teal";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
};

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  violet: "bg-violet-100 text-violet-700",
  teal: "bg-teal-100 text-teal-700",
};

export default function StatusBadge({
  label,
  tone = "neutral",
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
