"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type InstallmentPlanSetting = {
  id: string;
  provider: string;
  year: number;
  month: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type InstallmentPlanRate = {
  id: string;
  setting_id: string;
  installments: number;
  financial_cost_rate: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

type RateForm = {
  installments: number;
  financial_cost_rate: string;
  is_enabled: boolean;
};

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const initialForm = {
  provider: "PRISMA",
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  is_active: true,
  notes: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 md:py-2.5";

export default function PlanesCuotasClient() {
  const supabase = useMemo(() => createClient(), []);

  const [settings, setSettings] = useState<
    InstallmentPlanSetting[]
  >([]);

  const [rates, setRates] = useState<
    InstallmentPlanRate[]
  >([]);

  const [formData, setFormData] =
    useState(initialForm);

  const [rateForms, setRateForms] = useState<
    RateForm[]
  >([]);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [loadingInitialData, setLoadingInitialData] =
    useState(true);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [deleteSettingId, setDeleteSettingId] =
    useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);

  const monthLabel = (month: number) =>
    months[month - 1] || `Mes ${month}`;

  const formatPercent = (
    value: number | string | null
  ) => {
    return `${Number(value || 0).toLocaleString(
      "es-AR",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}%`;
  };

  const loadData = async () => {
    const [settingsRes, ratesRes] =
      await Promise.all([
        supabase
          .from("installment_plan_settings")
          .select("*")
          .order("year", { ascending: false })
          .order("month", { ascending: false }),

        supabase
          .from("installment_plan_rates")
          .select("*")
          .order("installments", {
            ascending: true,
          }),
      ]);

    if (settingsRes.error) {
      toast.error(
        `Error al cargar configuraciones: ${settingsRes.error.message}`
      );
    } else {
      setSettings(
        (settingsRes.data as InstallmentPlanSetting[]) ||
          []
      );
    }

    if (ratesRes.error) {
      toast.error(
        `Error al cargar planes: ${ratesRes.error.message}`
      );
    } else {
      setRates(
        (ratesRes.data as InstallmentPlanRate[]) ||
          []
      );
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingInitialData(true);

      try {
        await loadData();
      } finally {
        setLoadingInitialData(false);
      }
    };

    loadInitialData();
  }, []);

  const getRatesForSetting = (
    settingId: string
  ) => {
    return rates
      .filter(
        (rate) => rate.setting_id === settingId
      )
      .sort(
        (a, b) =>
          a.installments - b.installments
      );
  };

  const buildEmptyRates = () => {
    return Array.from(
      { length: 17 },
      (_, index) => ({
        installments: index + 2,
        financial_cost_rate: "",
        is_enabled: true,
      })
    );
  };

  const resetForm = () => {
    setFormData({
      provider: "PRISMA",
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      is_active: true,
      notes: "",
    });

    setRateForms(buildEmptyRates());
    setEditingId(null);
  };

  useEffect(() => {
    if (rateForms.length === 0) {
      setRateForms(buildEmptyRates());
    }
  }, []);

  const periodAlreadyExists = (
    provider: string,
    year: number,
    month: number
  ) => {
    return settings.some(
      (setting) =>
        setting.provider === provider &&
        setting.year === year &&
        setting.month === month &&
        setting.id !== editingId
    );
  };

  const deactivateOtherSettings = async (
    activeSettingId: string,
    provider: string
  ) => {
    const { error } = await supabase
      .from("installment_plan_settings")
      .update({ is_active: false })
      .eq("provider", provider)
      .neq("id", activeSettingId)
      .eq("is_active", true);

    return error;
  };

  const handleRateChange = (
    installments: number,
    value: string
  ) => {
    const normalized = value
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");

    setRateForms((previous) =>
      previous.map((rate) =>
        rate.installments === installments
          ? {
              ...rate,
              financial_cost_rate: normalized,
            }
          : rate
      )
    );
  };

  const handleToggleRate = (
    installments: number
  ) => {
    setRateForms((previous) =>
      previous.map((rate) =>
        rate.installments === installments
          ? {
              ...rate,
              is_enabled: !rate.is_enabled,
            }
          : rate
      )
    );
  };

  const handleEditSetting = (
    setting: InstallmentPlanSetting
  ) => {
    setEditingId(setting.id);

    setFormData({
      provider: setting.provider,
      year: setting.year,
      month: setting.month,
      is_active: setting.is_active,
      notes: setting.notes || "",
    });

    const existingRates =
      getRatesForSetting(setting.id);

    setRateForms(
      Array.from(
        { length: 17 },
        (_, index) => {
          const installments = index + 2;

          const existing =
            existingRates.find(
              (rate) =>
                rate.installments === installments
            );

          return {
            installments,
            financial_cost_rate: existing
              ? String(
                  existing.financial_cost_rate
                )
              : "",
            is_enabled:
              existing?.is_enabled ?? true,
          };
        }
      )
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const validateRates = () => {
    for (const rate of rateForms) {
      if (!rate.is_enabled) continue;

      const value = Number(
        rate.financial_cost_rate
      );

      if (
        !rate.financial_cost_rate ||
        Number.isNaN(value) ||
        value < 0
      ) {
        toast.warning(
          `Ingresá un porcentaje válido para ${rate.installments} cuotas.`
        );

        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const year = Number(formData.year);
    const month = Number(formData.month);

    if (!year || year < 2020 || year > 2100) {
      toast.warning(
        "Ingresá un año válido."
      );
      return;
    }

    if (!month || month < 1 || month > 12) {
      toast.warning(
        "Seleccioná un mes válido."
      );
      return;
    }

    if (!formData.provider.trim()) {
      toast.warning(
        "Ingresá el proveedor."
      );
      return;
    }

    if (
      periodAlreadyExists(
        formData.provider.trim(),
        year,
        month
      )
    ) {
      toast.warning(
        `Ya existe una configuración para ${formData.provider} - ${monthLabel(
          month
        )} ${year}.`
      );
      return;
    }

    if (!validateRates()) return;

    setSaving(true);

    const payload = {
      provider: formData.provider.trim(),
      year,
      month,
      is_active: formData.is_active,
      notes: formData.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let settingId = editingId;

    if (editingId) {
      const { error } = await supabase
        .from("installment_plan_settings")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setSaving(false);

        toast.error(
          `Error al actualizar configuración: ${error.message}`
        );

        return;
      }
    } else {
      const { data, error } = await supabase
        .from("installment_plan_settings")
        .insert([payload])
        .select()
        .single();

      if (error || !data) {
        setSaving(false);

        toast.error(
          `Error al crear configuración: ${
            error?.message ||
            "No se pudo obtener el registro creado."
          }`
        );

        return;
      }

      settingId = data.id;
    }

    if (!settingId) {
      setSaving(false);

      toast.error(
        "No se pudo determinar la configuración."
      );
      return;
    }

    if (formData.is_active) {
      const deactivateError =
        await deactivateOtherSettings(
          settingId,
          formData.provider.trim()
        );

      if (deactivateError) {
        toast.warning(
          "La configuración se guardó, pero no se pudieron desactivar automáticamente las demás."
        );
      }
    }

    const { error: deleteRatesError } =
      await supabase
        .from("installment_plan_rates")
        .delete()
        .eq("setting_id", settingId);

    if (deleteRatesError) {
      setSaving(false);

      toast.error(
        `No se pudieron actualizar los planes: ${deleteRatesError.message}`
      );

      return;
    }

    const ratesPayload = rateForms.map(
      (rate) => ({
        setting_id: settingId,
        installments: rate.installments,
        financial_cost_rate: Number(
          rate.financial_cost_rate || 0
        ),
        is_enabled: rate.is_enabled,
        updated_at: new Date().toISOString(),
      })
    );

    const { error: insertRatesError } =
      await supabase
        .from("installment_plan_rates")
        .insert(ratesPayload);

    setSaving(false);

    if (insertRatesError) {
      toast.error(
        `No se pudieron guardar los planes: ${insertRatesError.message}`
      );

      return;
    }

    toast.success(
      editingId
        ? "Configuración actualizada correctamente."
        : "Configuración creada correctamente."
    );

    resetForm();
    await loadData();
  };

  const handleDeleteSetting = async () => {
    if (!deleteSettingId) return;

    const settingToDelete =
      settings.find(
        (setting) =>
          setting.id === deleteSettingId
      );

    if (!settingToDelete) return;

    setDeleting(true);

    const { error } = await supabase
      .from("installment_plan_settings")
      .delete()
      .eq("id", deleteSettingId);

    setDeleting(false);

    if (error) {
      toast.error(
        `No se pudo eliminar la configuración: ${error.message}`
      );
      return;
    }

    toast.success(
      `Configuración de ${monthLabel(
        settingToDelete.month
      )} ${settingToDelete.year} eliminada.`
    );

    if (editingId === deleteSettingId) {
      resetForm();
    }

    setDeleteSettingId(null);
    await loadData();
  };

  const filteredSettings = useMemo(() => {
    const text = search
      .trim()
      .toLowerCase();

    return settings.filter((setting) => {
      if (!text) return true;

      return (
        setting.provider
          .toLowerCase()
          .includes(text) ||
        String(setting.year).includes(text) ||
        monthLabel(setting.month)
          .toLowerCase()
          .includes(text) ||
        (setting.is_active
          ? "activa"
          : "inactiva"
        ).includes(text) ||
        (setting.notes || "")
          .toLowerCase()
          .includes(text)
      );
    });
  }, [settings, search]);

  const selectedSetting =
    editingId
      ? settings.find(
          (setting) =>
            setting.id === editingId
        ) || null
      : null;

  const activeSetting =
    settings.find(
      (setting) =>
        setting.is_active &&
        setting.provider === "PRISMA"
    ) || null;

  if (loadingInitialData) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando planes de cuotas...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      {/* ENCABEZADO */}
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Planes de cuotas
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Administrá los costos financieros vigentes
          para cada cantidad de cuotas.
        </p>
      </div>

      {/* CONFIGURACIÓN ACTIVA */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-950">
              Configuración vigente
            </p>

            {activeSetting ? (
              <>
                <p className="mt-1 text-sm text-blue-800">
                  {activeSetting.provider} ·{" "}
                  {monthLabel(
                    activeSetting.month
                  )}{" "}
                  {activeSetting.year}
                </p>

                <p className="mt-1 text-xs text-blue-700">
                  {
                    getRatesForSetting(
                      activeSetting.id
                    ).filter(
                      (rate) =>
                        rate.is_enabled
                    ).length
                  }{" "}
                  planes habilitados.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-blue-800">
                No existe una configuración activa.
              </p>
            )}
          </div>

          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
            PRISMA
          </span>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* FORMULARIO */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  {editingId
                    ? "Editar configuración"
                    : "Nueva configuración mensual"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {selectedSetting
                    ? `Estás modificando ${monthLabel(
                        selectedSetting.month
                      )} ${selectedSetting.year}.`
                    : "Definí el período y los porcentajes vigentes."}
                </p>
              </div>

              {editingId && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Modo edición
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <FormSection
              number="1"
              title="Período"
              description="Seleccioná el mes y año correspondiente."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Proveedor">
                  <input
                    className={inputClass}
                    value={formData.provider}
                    onChange={(event) =>
                      setFormData(
                        (previous) => ({
                          ...previous,
                          provider:
                            event.target.value,
                        })
                      )
                    }
                    disabled={saving}
                  />
                </Field>

                <Field label="Año">
                  <input
                    type="number"
                    min="2020"
                    max="2100"
                    className={inputClass}
                    value={formData.year}
                    onChange={(event) =>
                      setFormData(
                        (previous) => ({
                          ...previous,
                          year: Number(
                            event.target.value
                          ),
                        })
                      )
                    }
                    disabled={saving}
                  />
                </Field>

                <Field label="Mes">
                  <select
                    className={inputClass}
                    value={formData.month}
                    onChange={(event) =>
                      setFormData(
                        (previous) => ({
                          ...previous,
                          month: Number(
                            event.target.value
                          ),
                        })
                      )
                    }
                    disabled={saving}
                  >
                    {months.map(
                      (label, index) => (
                        <option
                          key={label}
                          value={index + 1}
                        >
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    formData.is_active
                  }
                  onChange={(event) =>
                    setFormData(
                      (previous) => ({
                        ...previous,
                        is_active:
                          event.target.checked,
                      })
                    )
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  disabled={saving}
                />

                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    Configuración activa
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Al activarla, la configuración
                    vigente anterior de este proveedor
                    quedará inactiva.
                  </span>
                </span>
              </label>
            </FormSection>

            <FormSection
              number="2"
              title="Costos financieros"
              description="Configurá el porcentaje aplicable para cada plan de 2 a 18 cuotas."
              bordered
            >
              <div className="space-y-2">
                {rateForms.map((rate) => (
                  <div
                    key={rate.installments}
                    className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {rate.installments}
                      </p>

                      <p className="text-[11px] text-slate-400">
                        cuotas
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          rate.financial_cost_rate
                        }
                        onChange={(event) =>
                          handleRateChange(
                            rate.installments,
                            event.target.value
                          )
                        }
                        disabled={
                          saving ||
                          !rate.is_enabled
                        }
                        className={`${inputClass} pr-8`}
                        placeholder="0,00"
                      />

                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
                        %
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleToggleRate(
                          rate.installments
                        )
                      }
                      disabled={saving}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        rate.is_enabled
                          ? "bg-emerald-600"
                          : "bg-slate-300"
                      }`}
                      aria-label={`${
                        rate.is_enabled
                          ? "Deshabilitar"
                          : "Habilitar"
                      } ${rate.installments} cuotas`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          rate.is_enabled
                            ? "left-[22px]"
                            : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection
              number="3"
              title="Observaciones"
              description="Agregá notas internas si fuera necesario."
              bordered
            >
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={formData.notes}
                onChange={(event) =>
                  setFormData(
                    (previous) => ({
                      ...previous,
                      notes:
                        event.target.value,
                    })
                  )
                }
                disabled={saving}
                placeholder="Ej: actualización informada por PRISMA..."
              />
            </FormSection>

            <div className="border-t border-slate-200 px-4 py-4 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {saving
                    ? "Guardando..."
                    : editingId
                      ? "Actualizar configuración"
                      : "Guardar configuración"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                >
                  {editingId
                    ? "Cancelar"
                    : "Limpiar"}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* HISTÓRICO */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  Configuraciones
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredSettings.length} de{" "}
                  {settings.length} períodos
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Total: {settings.length}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                className={inputClass}
                placeholder="Buscar por proveedor, mes, año o estado..."
              />

              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-4">
            {filteredSettings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-500">
                  No hay configuraciones registradas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSettings.map(
                  (setting) => {
                    const settingRates =
                      getRatesForSetting(
                        setting.id
                      );

                    const enabledRates =
                      settingRates.filter(
                        (rate) =>
                          rate.is_enabled
                      );

                    const isSelected =
                      setting.id === editingId;

                    return (
                      <article
                        key={setting.id}
                        className={`rounded-xl border p-4 ${
                          isSelected
                            ? "border-blue-300 bg-blue-50/40"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-slate-950">
                                {
                                  setting.provider
                                }{" "}
                                ·{" "}
                                {monthLabel(
                                  setting.month
                                )}{" "}
                                {setting.year}
                              </h3>

                              <StatusBadge
                                active={
                                  setting.is_active
                                }
                              />
                            </div>

                            <p className="mt-2 text-xs text-slate-500">
                              {
                                enabledRates.length
                              }{" "}
                              planes habilitados
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {enabledRates.map(
                            (rate) => (
                              <div
                                key={rate.id}
                                className="rounded-lg bg-slate-50 p-2.5"
                              >
                                <p className="text-[11px] text-slate-400">
                                  {
                                    rate.installments
                                  }{" "}
                                  cuotas
                                </p>

                                <p className="mt-1 text-sm font-semibold text-slate-950">
                                  {formatPercent(
                                    rate.financial_cost_rate
                                  )}
                                </p>
                              </div>
                            )
                          )}
                        </div>

                        {setting.notes && (
                          <div className="mt-4 rounded-lg bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Observaciones
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-700">
                              {setting.notes}
                            </p>
                          </div>
                        )}

                        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() =>
                              handleEditSetting(
                                setting
                              )
                            }
                            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
                          >
                            {isSelected
                              ? "Editando"
                              : "Editar"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteSettingId(
                                setting.id
                              )
                            }
                            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 sm:w-auto"
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {deleteSettingId && (
        <DeleteSettingModal
          setting={
            settings.find(
              (setting) =>
                setting.id ===
                deleteSettingId
            ) || null
          }
          deleting={deleting}
          monthLabel={monthLabel}
          onCancel={() =>
            setDeleteSettingId(null)
          }
          onConfirm={handleDeleteSetting}
        />
      )}
    </main>
  );
}

function FormSection({
  number,
  title,
  description,
  bordered = false,
  children,
}: {
  number: string;
  title: string;
  description: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`px-4 py-5 md:px-6 md:py-6 ${
        bordered
          ? "border-t border-slate-200"
          : ""
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
          {number}
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-950 md:text-lg">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
            {description}
          </p>
        </div>
      </div>

      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Activa" : "Inactiva"}
    </span>
  );
}

function DeleteSettingModal({
  setting,
  deleting,
  monthLabel,
  onCancel,
  onConfirm,
}: {
  setting: InstallmentPlanSetting | null;
  deleting: boolean;
  monthLabel: (month: number) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!setting) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-950">
            Eliminar configuración
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Esta acción no se puede deshacer.
          </p>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-slate-700">
            ¿Querés eliminar{" "}
            <span className="font-semibold text-slate-950">
              {setting.provider} ·{" "}
              {monthLabel(setting.month)}{" "}
              {setting.year}
            </span>
            ?
          </p>

          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              También se eliminarán todos los
              porcentajes de cuotas asociados.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 sm:w-auto"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:w-auto"
          >
            {deleting
              ? "Eliminando..."
              : "Eliminar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}