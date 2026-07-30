"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
};

export default function PrimaryButton({
  children,
  loading = false,
  loadingLabel = "Procesando...",
  disabled,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 ${className}`}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
