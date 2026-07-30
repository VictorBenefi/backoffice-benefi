"use client";

import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>

      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
