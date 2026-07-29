type DocumentProgressProps = {
  uploaded: number;
  totalRequired: number;
  percentage: number;
  compact?: boolean;
};

export default function DocumentProgress({
  uploaded,
  totalRequired,
  percentage,
  compact = false,
}: DocumentProgressProps) {
  const normalizedPercentage = Math.min(
    Math.max(percentage, 0),
    100
  );

  const isComplete =
    totalRequired > 0 && normalizedPercentage === 100;

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-700">
              Legajo documental
            </p>

            <p className="mt-0.5 text-[11px] text-slate-500">
              {totalRequired > 0
                ? `${uploaded} de ${totalRequired} obligatorios`
                : "Sin requisitos configurados"}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isComplete
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {normalizedPercentage} %
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete
                ? "bg-emerald-500"
                : "bg-amber-500"
            }`}
            style={{
              width: `${normalizedPercentage}%`,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">
            Legajo documental
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {totalRequired > 0
              ? `${uploaded} de ${totalRequired} documentos obligatorios cargados`
              : "No existen requisitos obligatorios configurados"}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            isComplete
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {normalizedPercentage} %
        </span>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete
              ? "bg-emerald-500"
              : "bg-amber-500"
          }`}
          style={{
            width: `${normalizedPercentage}%`,
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
        <span
          className={
            isComplete
              ? "font-medium text-emerald-700"
              : "font-medium text-amber-700"
          }
        >
          {isComplete ? "Legajo completo" : "Legajo pendiente"}
        </span>

        {totalRequired > 0 && (
          <span className="text-slate-500">
            {Math.max(totalRequired - uploaded, 0)} pendientes
          </span>
        )}
      </div>
    </div>
  );
}