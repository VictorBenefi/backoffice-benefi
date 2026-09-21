"use client";

import { useEffect, useState } from "react";

type Partner = {
  id: string;
  name: string;
  legal_name: string | null;
  cuit: string | null;
  is_active: boolean;
  is_partner: boolean;
};

type PartnerCommissionSetting = {
  id: string;
  merchant_group_id: string;
  payment_method:
  | "QR"
  | "DEBIT"
  | "CREDIT"
  | "PREPAID";
  card_scope:
  | "ALL"
  | "NATIONAL"
  | "INTERNATIONAL";
  commission_rate: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const paymentMethodLabel = (method: string) => {
  switch (method) {
    case "QR":
      return "QR";

    case "DEBIT":
      return "Tarjeta de débito";

    case "CREDIT":
      return "Tarjeta de crédito";

    case "PREPAID":
    return "Tarjeta prepaga";

    default:
      return method;
  }
};

function cardScopeLabel(
  scope: string
) {
  switch (scope) {
    case "NATIONAL":
      return "Nacional";
    case "INTERNATIONAL":
      return "Internacional";
    default:
      return "Todas";
  }
}

const formatPercent = (
  value: number | string | null
) => {
  return `${Number(value || 0).toLocaleString(
    "es-AR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }
  )}%`;
};

const formatDate = (
  value: string | null
) => {
  if (!value) {
    return "Sin vencimiento";
  }

  const [year, month, day] =
    value.split("-");

  return `${day}/${month}/${year}`;
};

export default function ComisionesPartnersClient() {
  const [partners, setPartners] =
    useState<Partner[]>([]);

  const [settings, setSettings] =
    useState<PartnerCommissionSetting[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [showForm, setShowForm] =
    useState(false);

  const [error, setError] =
    useState("");

const [deleteItem, setDeleteItem] =
  useState<PartnerCommissionSetting | null>(
    null
  );

const [deleting, setDeleting] =
  useState(false);

  const [editingId, setEditingId] =
  useState<string | null>(null);

const [form, setForm] = useState({
  merchant_group_id: "",
  payment_method: "",
  card_scope: "ALL",
  commission_rate: "",
  valid_from: "",
  notes: "",
});

const loadData = async () => {
  setLoading(true);
  setError("");

  try {
    const response = await fetch(
      "/api/comisiones-partners",
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "No se pudieron cargar las comisiones."
      );
    }

    setPartners(
      (result.partners || []) as Partner[]
    );

    setSettings(
      (result.settings ||
        []) as PartnerCommissionSetting[]
    );
  } catch (loadError) {
    console.error(loadError);

    setError(
      loadError instanceof Error
        ? loadError.message
        : "No se pudieron cargar las comisiones Partner."
    );
  } finally {
    setLoading(false);
  }
};

const resetForm = () => {
  setEditingId(null);

  setForm({
  merchant_group_id: "",
  payment_method: "",
  card_scope: "ALL",
  commission_rate: "",
  valid_from: "",
  notes: "",
});
};

const startEditing = (
  item: PartnerCommissionSetting
) => {
  setEditingId(item.id);

  setForm({
  merchant_group_id:
    item.merchant_group_id,
  payment_method:
    item.payment_method,
  card_scope:
    item.card_scope || "ALL",
  commission_rate:
    String(item.commission_rate),
  valid_from:
    item.valid_from,
  notes:
    item.notes || "",
});

  setError("");
  setShowForm(true);

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const handleSave = async () => {
  setError("");

  if (
    !form.merchant_group_id ||
    !form.payment_method ||
    form.commission_rate === "" ||
    !form.valid_from
  ) {
    setError(
      "Completá el Partner, medio de pago, comisión y fecha de vigencia."
    );

    return;
  }

  try {
    setSaving(true);

    const isEditing =
      Boolean(editingId);

    const response = await fetch(
      "/api/comisiones-partners",
      {
        method: isEditing
          ? "PATCH"
          : "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? {
                id: editingId,
                commission_rate:
                  form.commission_rate,
                valid_from:
                  form.valid_from,
                notes:
                  form.notes,
              }
            : form
        ),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          (isEditing
            ? "No se pudo actualizar la configuración."
            : "No se pudo guardar la configuración.")
      );
    }

    resetForm();
    setShowForm(false);

    await loadData();
  } catch (saveError) {
    console.error(saveError);

    setError(
      saveError instanceof Error
        ? saveError.message
        : "No se pudo guardar la comisión Partner."
    );
  } finally {
    setSaving(false);
  }
};

const handleToggleActive = async (
  item: PartnerCommissionSetting
) => {
  setError("");

  try {
    const response = await fetch(
      "/api/comisiones-partners",
      {
        method: "PATCH",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          is_active:
            !item.is_active,
        }),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "No se pudo modificar el estado."
      );
    }

    await loadData();
  } catch (toggleError) {
    console.error(toggleError);

    setError(
      toggleError instanceof Error
        ? toggleError.message
        : "No se pudo modificar el estado de la comisión."
    );
  }
};

const handleDelete = async () => {
  if (!deleteItem) {
    return;
  }

  setError("");

  try {
    setDeleting(true);

    const response = await fetch(
      "/api/comisiones-partners",
      {
        method: "DELETE",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          id: deleteItem.id,
        }),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "No se pudo eliminar la configuración."
      );
    }

    if (editingId === deleteItem.id) {
      resetForm();
      setShowForm(false);
    }

    setDeleteItem(null);

    await loadData();
  } catch (deleteError) {
    console.error(deleteError);

    setError(
      deleteError instanceof Error
        ? deleteError.message
        : "No se pudo eliminar la comisión Partner."
    );
  } finally {
    setDeleting(false);
  }
};
  const getPartnerName = (
    merchantGroupId: string
  ) => {
    return (
      partners.find(
        (partner) =>
          partner.id === merchantGroupId
      )?.name || "Partner"
    );
  };

  useEffect(() => {
    void loadData();
  }, []);



  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Comisiones Partners
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Configuración de las comisiones
            correspondientes a los Partners de
            BENEFÍ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          disabled={partners.length === 0}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Nueva configuración
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading &&
      partners.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay grupos activos configurados
          como Partner.
        </div>
      ) : null}

      {showForm && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">
              Nueva configuración
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Definí la comisión que recibirá el
              Partner para un medio de pago a
              partir de una fecha.
            </p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Partner
              </label>

              <select
                value={
                  form.merchant_group_id
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    merchant_group_id:
                      event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="">
                  Seleccionar
                </option>

                {partners.map(
                  (partner) => (
                    <option
                      key={partner.id}
                      value={partner.id}
                    >
                      {partner.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Medio de pago
              </label>

              <select
                value={
                  form.payment_method
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    payment_method:
                      event.target.value,
                    card_scope: "ALL",
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value="">
                  Seleccionar
                </option>

                <option value="QR">
                  QR
                </option>

                <option value="DEBIT">
                  Tarjeta de débito
                </option>

                <option value="CREDIT">
                  Tarjeta de crédito
                </option>

                <option value="PREPAID">
                  Tarjeta prepaga
                </option>
              </select>
            </div>

            {form.payment_method !== "QR" &&
            form.payment_method !== "" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tipo de tarjeta
                </label>

                <select
                  value={form.card_scope}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      card_scope:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="ALL">
                    Todas
                  </option>
                  <option value="NATIONAL">
                    Nacional
                  </option>
                  <option value="INTERNATIONAL">
                    Internacional
                  </option>
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Comisión Partner %
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
                value={
                  form.commission_rate
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    commission_rate:
                      event.target.value,
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
                    valid_from:
                      event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Observaciones
              </label>

              <input
                type="text"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes:
                      event.target.value,
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
                resetForm();
              }}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Guardando..."
                : "Guardar configuración"}
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">
            Configuraciones registradas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Historial de porcentajes
            configurados para cada Partner.
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            Cargando configuraciones...
          </div>
        ) : settings.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            No hay comisiones Partner
            configuradas.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">
                      Partner
                    </th>

                    <th className="px-5 py-3">
                      Medio de pago
                    </th>

                    <th className="...">
                      TIPO DE TARJETA
                    </th>

                    <th className="px-5 py-3 text-right">
                      Comisión
                    </th>

                    <th className="px-5 py-3">
                      Vigencia desde
                    </th>

                    <th className="px-5 py-3">
                      Vigencia hasta
                    </th>

                    <th className="px-5 py-3">
                      Estado
                    </th>

                    <th className="px-5 py-3 text-right">
                        Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {settings.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="text-slate-700"
                      >
                        <td className="px-5 py-4 font-medium text-slate-950">
                          {getPartnerName(
                            item.merchant_group_id
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {paymentMethodLabel(
                            item.payment_method
                          )}
                        </td>

                        <td className="...">
                          {item.payment_method === "QR"
                            ? "-"
                            : cardScopeLabel(
                                item.card_scope
                              )}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold">
                          {formatPercent(
                            item.commission_rate
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {formatDate(
                            item.valid_from
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {formatDate(
                            item.valid_to
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              item.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.is_active
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                                <button
                                type="button"
                                onClick={() =>
                                    startEditing(item)
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                Editar
                                </button>

                                <button
                                type="button"
                                onClick={() =>
                                    handleToggleActive(item)
                                }
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                                >
                                {item.is_active
                                    ? "Inactivar"
                                    : "Activar"}
                                </button>

                                <button
                                type="button"
                                onClick={() =>
                                setDeleteItem(item)
                                }
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                                >
                                Eliminar
                                </button>
                            </div>
                            </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
            {settings.map(
                (item) => (
                <div
                    key={item.id}
                    className="space-y-3 p-4"
                >
                    <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="font-semibold text-slate-950">
                        {getPartnerName(
                            item.merchant_group_id
                        )}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                        {paymentMethodLabel(
                            item.payment_method
                        )}
                        </p>
                    </div>

                    <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                    >
                        {item.is_active
                        ? "Activo"
                        : "Inactivo"}
                    </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                        Comisión
                        </p>

                        <p className="mt-1 font-semibold text-slate-950">
                        {formatPercent(
                            item.commission_rate
                        )}
                        </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">
                        Vigencia
                        </p>

                        <p className="mt-1 font-semibold text-slate-950">
                        {formatDate(
                            item.valid_from
                        )}
                        </p>
                    </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button
                        type="button"
                        onClick={() =>
                        startEditing(item)
                        }
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                        Editar
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                        handleToggleActive(item)
                        }
                        className="flex-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                        {item.is_active
                        ? "Inactivar"
                        : "Activar"}
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                        setDeleteItem(item)
                        }
                        className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100"
                    >
                        Eliminar
                    </button>
                    </div>
                </div>
                )
            )}
            </div>
          </>
        )}
      </section>
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-950">
                Eliminar configuración
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                Esta acción eliminará definitivamente
                la configuración seleccionada.
                </p>
            </div>

            <div className="space-y-3 px-5 py-5">
                <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">
                    {getPartnerName(
                    deleteItem.merchant_group_id
                    )}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                    {paymentMethodLabel(
                    deleteItem.payment_method
                    )}
                    {" · "}
                    {formatPercent(
                    deleteItem.commission_rate
                    )}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                    Vigencia desde{" "}
                    {formatDate(
                    deleteItem.valid_from
                    )}
                </p>
                </div>

                <p className="text-sm text-slate-600">
                ¿Confirmás que querés eliminar esta
                configuración?
                </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                type="button"
                onClick={() =>
                    setDeleteItem(null)
                }
                disabled={deleting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                Cancelar
                </button>

                <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                {deleting
                    ? "Eliminando..."
                    : "Eliminar configuración"}
                </button>
            </div>
            </div>
        </div>
        )}
    </div>
  );
}