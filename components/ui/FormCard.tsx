"use client";

import type { ReactNode } from "react";

type FormCardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export default function FormCard({
  title,
  description,
  children,
  footer,
  className = "",
}: FormCardProps) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {title || description ? (
        <div className="mb-5">
          {title ? (
            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
          ) : null}

          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      ) : null}

      {children}

      {footer ? (
        <div className="mt-5 border-t border-slate-200 pt-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
