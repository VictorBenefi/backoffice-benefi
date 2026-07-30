"use client";

import type { ReactNode } from "react";

type InfoCardProps = {
  eyebrow?: string;
  title?: string;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function InfoCard({
  eyebrow,
  title,
  badge,
  children,
  className = "",
}: InfoCardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 p-4 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          ) : null}

          {title ? (
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {title}
            </p>
          ) : null}
        </div>

        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
