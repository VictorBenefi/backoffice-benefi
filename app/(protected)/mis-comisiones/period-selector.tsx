"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

type PeriodOption = {
  value: string;
  label: string;
};

type PeriodSelectorProps = {
  periods: PeriodOption[];
  selectedValue: string;
  status: "closed" | "estimated";
};

export default function PeriodSelector({
  periods,
  selectedValue,
  status,
}: PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [changingPeriod, startTransition] =
    useTransition();

  function handleChange(value: string) {
    const [year, month] = value.split("-");

    startTransition(() => {
      router.push(
        `${pathname}?year=${year}&month=${month}`
      );
    });
  }

  const isClosed = status === "closed";

  return (
    <div
      className={`w-full rounded-2xl border p-4 shadow-sm sm:w-auto sm:min-w-[310px] ${
        isClosed
          ? "border-emerald-200 bg-emerald-50"
          : "border-blue-200 bg-blue-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              isClosed
                ? "text-emerald-600"
                : "text-blue-600"
            }`}
          >
            Período consultado
          </p>

          <p
            className={`mt-1 text-xs ${
              isClosed
                ? "text-emerald-700"
                : "text-blue-700"
            }`}
          >
            {isClosed
              ? "Liquidación mensual definitiva"
              : "Comisión estimada en curso"}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isClosed
              ? "bg-emerald-100 text-emerald-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {isClosed ? "Cerrada" : "Estimada"}
        </span>
      </div>

      <select
        value={selectedValue}
        disabled={changingPeriod}
        onChange={(event) =>
          handleChange(event.target.value)
        }
        className={`mt-3 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none transition disabled:cursor-wait disabled:opacity-70 ${
          isClosed
            ? "border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
            : "border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
        }`}
      >
        {periods.map((period) => (
          <option
            key={period.value}
            value={period.value}
          >
            {period.label}
          </option>
        ))}
      </select>

      {changingPeriod && (
        <p className="mt-2 text-xs text-slate-500">
          Cargando período...
        </p>
      )}
    </div>
  );
}