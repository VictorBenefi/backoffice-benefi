"use client";

import type { ReactNode } from "react";

type InfoItemProps = {
  label: string;
  value: ReactNode;
  className?: string;
};

export default function InfoItem({
  label,
  value,
  className = "",
}: InfoItemProps) {
  return (
    <div className={`rounded-lg bg-white p-3 ${className}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </div>
    </div>
  );
}
