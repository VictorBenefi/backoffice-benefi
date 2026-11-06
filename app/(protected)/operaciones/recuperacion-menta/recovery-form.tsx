
"use client";

import { useState } from "react";

type VerificationResult = {
  ok?: boolean;
  error?: string;
  missing_operations?: unknown[];
  recoveryToken?: string | null;
  recoveryEnabled?: boolean;
  summary?: Record<string, unknown>;
};

export default function RecoveryForm() {
  const [start, setStart] = useState("2026-11-03T15:13");
  const [end, setEnd] = useState("2026-11-03T23:05");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
const [recoveryResult, setRecoveryResult] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  function toArgentinaISO(value: string) {
    return new Date(`${value}:00-03:00`).toISOString();
  }

  
  async function recover() {
    if (
      !result?.recoveryEnabled ||
      !result.recoveryToken ||
      loading ||
      recovering
    ) {
      alert(
        "Primero debés realizar una verificación válida para autorizar la recuperación."
      );
      return;
    }

    const confirmed = window.confirm(
      "¿Confirmás la recuperación de las operaciones MENTA del período seleccionado?\n\n" +
      "Esta acción puede insertar o actualizar operaciones en Supabase.\n" +
      "No modifica el cursor histórico."
    );

    if (!confirmed) return;

    setRecovering(true);
    setRecoveryResult(null);

    // La autorización es de un solo uso.
    const token = result.recoveryToken;
    setResult((previous) =>
      previous
        ? {
            ...previous,
            recoveryToken: null,
            recoveryEnabled: false,
          }
        : null
    );

    try {
      const response = await fetch("/api/menta/transactions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "recover",
          start: toArgentinaISO(start),
          end: toArgentinaISO(end),
          recoveryToken: token,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(
          data.error || "No se pudo completar la recuperación."
        );
      }

      setRecoveryResult(
        `Recuperación completada. Tramos procesados: ${
          data.completedPeriods ?? 0
        }. Operaciones sincronizadas: ${
          data.summary?.synced ?? 0
        }.`
      );
    } catch (error) {
      setRecoveryResult(
        error instanceof Error
          ? `Error: ${error.message}. Verificá nuevamente antes de reintentar.`
          : "Error inesperado. Verificá nuevamente antes de reintentar."
      );
    } finally {
      setRecovering(false);
    }
  }

  async function verify() {
    setResult(null);

    if (!start || !end) {
      alert("Debés completar ambas fechas y horas.");
      return;
    }

    const startDate = new Date(`${start}:00-03:00`);
    const endDate = new Date(`${end}:00-03:00`);

    if (
      !Number.isFinite(startDate.getTime()) ||
      !Number.isFinite(endDate.getTime()) ||
      startDate >= endDate ||
      endDate.getTime() - startDate.getTime() > 24 * 60 * 60 * 1000
    ) {
      alert("Seleccioná un período válido de hasta 24 horas.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/menta/transactions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verify",
          start: toArgentinaISO(start),
          end: toArgentinaISO(end),
        }),
      });

      const data: VerificationResult = await response.json();

      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || "No se pudo verificar el período.");
      }

      setResult(data);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al consultar MENTA."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Verificación de operaciones MENTA
      </h2>

      <p className="mt-2 text-sm text-slate-600">
        Seleccioná un período máximo de 24 horas. Las fechas y horas
        corresponden a Argentina (UTC-03:00).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Fecha y hora inicial
          </label>
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setResult(null);
            }}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Fecha y hora final
          </label>
          <input
            type="datetime-local"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
              setResult(null);
            }}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={verify}
        disabled={loading}
        className="mt-6 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {loading ? "Verificando operaciones..." : "Verificar operaciones"}
      </button>

      {result && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h3 className="font-semibold text-slate-900">
            Resultado de la verificación
          </h3>

          <p className="mt-3 text-sm text-slate-700">
            Operaciones faltantes detectadas:{" "}
            <strong>{result.missing_operations?.length ?? 0}</strong>
          </p>

          {result.summary && (
            <pre className="mt-4 overflow-auto rounded-lg bg-white p-4 text-xs text-slate-700">
              {JSON.stringify(result.summary, null, 2)}
            </pre>
          )}

          <p className="mt-4 text-sm text-amber-700">
            Esta consulta no modifica operaciones ni liquidaciones.
          </p>
          {result.recoveryEnabled && result.recoveryToken && (
            <button
                type="button"
                onClick={recover}
                disabled={loading || recovering}
                className="mt-5 rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
                {recovering
                ? "Recuperando operaciones..."
                : "Recuperar operaciones"}
            </button>
            )}
                    </div>
      )}
      {recoveryResult && (
        <div
            role="status"
            className="mt-5 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800"
        >
            {recoveryResult}
        </div>
        )}
    </section>
  );
}
