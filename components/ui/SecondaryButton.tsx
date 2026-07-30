"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function SecondaryButton({
  children,
  className = "",
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
