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
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      {title || description ? (
        <div className="mb-4 sm:mb-5">
          {title ? (
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              {title}
            </h2>
          ) : null}

          {description ? (
            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      {children}

      {footer ? (
        <div className="mt-4 border-t border-slate-200 pt-4 sm:mt-5 sm:pt-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}