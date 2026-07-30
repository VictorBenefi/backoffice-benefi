"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type DangerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function DangerButton({
  children,
  className = "",
  ...props
}: DangerButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
