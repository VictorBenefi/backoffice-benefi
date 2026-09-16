"use client";

import { useEffect, useState } from "react";


type PaymentCostSetting = {
  id: string;
  payment_method: "QR" | "DEBIT" | "CREDIT";
  acquirer_rate: number;
  menta_rate: number;
  panda_rate: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  notes: string | null;
};

const paymentMethodLabel = (method: string) => {
  switch (method) {
    case "QR":
      return "QR";
    case "DEBIT":
      return "Tarjeta de débito";
    case "CREDIT":
      return "Tarjeta de crédito";
    default:
      return method;
  }
};

const formatPercent = (value: number | string | null) => {
  return `${Number(value || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}%`;
};

const formatDate = (value: string | null) => {
  if (!value) return "Sin vencimiento";

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
};

export default function CostosPagosClient() {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
  payment_method: "",
  acquirer_rate: "",
  menta_rate: "",
  panda_rate: "",
  valid_from: "",
  notes: "",
});
  const [settings, setSettings] = useState<PaymentCostSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

    const loadData = async () => {
    setLoading(true);
    setError("");

    try {
        const response = await fetch("/api/costos-pagos", {
        method: "GET",
        cache: "no-store",
        });

        if (!response.ok) {
        throw new Error("Error al obtener los costos de pagos.");
        }

        const result = await response.json();

        setSettings(
        (result.settings || []) as PaymentCostSetting[]
        );
    } catch (loadError) {
        console.error(loadError);
        setError(
        "No se pudieron cargar los costos de procesamiento."
        );
    } finally {
        setLoading(false);
    }
    };
const handleSave = async () => {
  setError("");

  if (
    !form.payment_method ||
    !form.acquirer_rate ||
    !form.menta_rate ||
    !form.panda_rate ||
    !form.valid_from
  ) {
    setError(
      "Completá el medio de pago, los costos y la fecha de vigencia."
    );
    return;
  }

  try {
     setSaving(true);
    const response = await fetch("/api/costos-pagos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "No se pudo guardar la configuración."
      );
    }

    setForm({
      payment_method: "",
      acquirer_rate: "",
      menta_rate: "",
      panda_rate: "",
      valid_from: "",
      notes: "",
    });

    setShowForm(false);

    await loadData();
    } catch (saveError) {
        console.error(saveError);

        setError(
        saveError instanceof Error
            ? saveError.message
            : "No se pudo guardar la configuración."
        );
    } finally {
        setSaving(false);
    }
    };
  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <h1 className="text-2xl font-bold text-slate-950">
            Costos de pagos
            </h1>

            <p className="mt-1 text-sm text-slate-500">
            Configuración interna de costos para calcular la rentabilidad de
            BENEFÍ.
            </p>
        </div>

        <button
            type="button"
            onClick={() => {
            setError("");
            setShowForm(true);
            }}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
        >
            Nueva configuración
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {showForm && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">
                    Nueva configuración
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                    Definí los costos internos que se aplicarán desde una nueva fecha
                    de vigencia.
                </p>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                    Medio de pago
                    </label>

                    <select
                        value={form.payment_method}
                        onChange={(event) =>
                            setForm((current) => ({
                            ...current,
                            payment_method: event.target.value,
                            }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        >
                    <option value="">Seleccionar</option>
                    <option value="QR">QR</option>
                    <option value="DEBIT">Tarjeta de débito</option>
                    <option value="CREDIT">Tarjeta de crédito</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                    Adquirente %
                    </label>

                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.acquirer_rate}
                        onChange={(event) =>
                            setForm((current) => ({
                            ...current,
                            acquirer_rate: event.target.value,
                            }))
                        }
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                    MENTA %
                    </label>

                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.menta_rate}
                        onChange={(event) =>
                            setForm((current) => ({
                            ...current,
                            menta_rate: event.target.value,
                            }))
                        }
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                    Panda %
                    </label>

                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.panda_rate}
                        onChange={(event) =>
                            setForm((current) => ({
                            ...current,
                            panda_rate: event.target.value,
                            }))
                        }
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        />
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                    Vigencia desde
                    </label>

                    <input
                        type="date"
                        value={form.valid_from}
                        onChange={(event) =>
                            setForm((current) => ({
                            ...current,
                            valid_from: event.target.value,
                            }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        />
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                    Observaciones
                    </label>

                    <input
                        type="text"
                        value={form.notes}
                        onChange={(event) =>
                            setForm((current) => ({
                            ...current,
                            notes: event.target.value,
                            }))
                        }
                        placeholder="Opcional"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                        />
                </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={() => {
                    setShowForm(false);
                    setError("");
                    setForm({
                        payment_method: "",
                        acquirer_rate: "",
                        menta_rate: "",
                        panda_rate: "",
                        valid_from: "",
                        notes: "",
                    });
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                    Cancelar
                </button>

                <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                {saving ? "Guardando..." : "Guardar configuración"}
                </button>
                </div>
            </div>
            )}
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">
            Configuración vigente
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Porcentajes utilizados para Adquirente, MENTA y Panda.
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            Cargando configuración...
          </div>
        ) : settings.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            No hay configuraciones registradas.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Medio de pago</th>
                    <th className="px-5 py-3 text-right">Adquirente</th>
                    <th className="px-5 py-3 text-right">MENTA</th>
                    <th className="px-5 py-3 text-right">Panda</th>
                    <th className="px-5 py-3">Vigencia desde</th>
                    <th className="px-5 py-3">Vigencia hasta</th>
                    <th className="px-5 py-3">Estado</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {settings.map((item) => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="px-5 py-4 font-medium text-slate-950">
                        {paymentMethodLabel(item.payment_method)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {formatPercent(item.acquirer_rate)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {formatPercent(item.menta_rate)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        {formatPercent(item.panda_rate)}
                      </td>

                      <td className="px-5 py-4">
                        {formatDate(item.valid_from)}
                      </td>

                      <td className="px-5 py-4">
                        {formatDate(item.valid_to)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {settings.map((item) => (
                <div key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {paymentMethodLabel(item.payment_method)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Desde {formatDate(item.valid_from)}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Adquirente</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {formatPercent(item.acquirer_rate)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">MENTA</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {formatPercent(item.menta_rate)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Panda</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {formatPercent(item.panda_rate)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}