"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type CommissionSetting = {
  id: string;
  year: number;
  month: number;
  base_amount_per_installation: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type CommissionTarget = {
  id: string;
  commission_setting_id: string;
  installations_goal: number;
  bonus_amount: number;
  created_at: string;
};

const initialForm = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  base_amount_per_installation: "",
  notes: "",
  is_active: true,
};

const initialTarget = {
  installations_goal: "",
  bonus_amount: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 md:py-2.5";

export default function ComisionesClient() {
  const supabase = useMemo(() => createClient(), []);

  const [settings, setSettings] = useState<
    CommissionSetting[]
  >([]);
  const [targets, setTargets] = useState<
    CommissionTarget[]
  >([]);

  const [formData, setFormData] =
    useState(initialForm);

  const [targetForm, setTargetForm] =
    useState(initialTarget);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTarget, setLoadingTarget] =
    useState(false);

  const [loadingInitialData, setLoadingInitialData] =
    useState(true);

  const [editingId, setEditingId] = useState<
    string | null
  >(null);

  const [deleteSettingId, setDeleteSettingId] = useState<string | null>(null);
const [deletingSetting, setDeletingSetting] = useState(false);

  const monthLabel = (month: number) => {
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

    return months[month - 1] || `Mes ${month}`;
  };

  const formatMoney = (
    value: number | string | null
  ) => {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(numberValue);
  };

  const formatAmountInput = (value: string) => {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(Number(digits));
};

const parseAmountInput = (value: string) => {
  return value.replace(/\./g, "").replace(/\D/g, "");
};

  const loadData = async () => {
    const [settingsRes, targetsRes] =
      await Promise.all([
        supabase
          .from("commission_settings")
          .select("*")
          .order("year", { ascending: false })
          .order("month", { ascending: false }),

        supabase
          .from("commission_targets")
          .select("*")
          .order("installations_goal", {
            ascending: true,
          }),
      ]);

    if (settingsRes.error) {
      toast.error(
        `Error al cargar configuraciones: ${settingsRes.error.message}`
      );
    } else {
      setSettings(
        (settingsRes.data as CommissionSetting[]) ||
          []
      );
    }

    if (targetsRes.error) {
      toast.error(
        `Error al cargar objetivos: ${targetsRes.error.message}`
      );
    } else {
      setTargets(
        (targetsRes.data as CommissionTarget[]) ||
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

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      base_amount_per_installation: "",
      notes: "",
      is_active: true,
    });

    setTargetForm(initialTarget);
    setEditingId(null);
  };

  const getTargetsForSetting = (
    settingId: string
  ) => {
    return targets
      .filter(
        (target) =>
          target.commission_setting_id === settingId
      )
      .sort(
        (first, second) =>
          first.installations_goal -
          second.installations_goal
      );
  };

  const deactivateOtherSettings = async (
    activeSettingId: string
  ) => {
    const { error } = await supabase
      .from("commission_settings")
      .update({ is_active: false })
      .neq("id", activeSettingId)
      .eq("is_active", true);

    return error;
  };

  const periodAlreadyExists = (
    year: number,
    month: number
  ) => {
    return settings.some(
      (setting) =>
        setting.year === year &&
        setting.month === month &&
        setting.id !== editingId
    );
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const year = Number(formData.year);
    const month = Number(formData.month);

    const baseAmount = Number(
      formData.base_amount_per_installation
    );

    if (!year || year < 2020 || year > 2100) {
      toast.warning(
        "Ingresá un año válido para la configuración."
      );
      return;
    }

    if (!month || month < 1 || month > 12) {
      toast.warning("Seleccioná un mes válido.");
      return;
    }

    if (
      !formData.base_amount_per_installation ||
      Number.isNaN(baseAmount) ||
      baseAmount <= 0
    ) {
      toast.warning(
        "Ingresá un monto base por instalación mayor a cero."
      );
      return;
    }

    if (periodAlreadyExists(year, month)) {
      toast.warning(
        `Ya existe una configuración para ${monthLabel(
          month
        )} ${year}.`
      );
      return;
    }

    setLoading(true);

    const payload = {
      year,
      month,
      base_amount_per_installation:
        baseAmount,
      notes: formData.notes.trim() || null,
      is_active: formData.is_active,
    };

    if (editingId) {
      const { error } = await supabase
        .from("commission_settings")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setLoading(false);

        toast.error(
          `Error al actualizar configuración: ${error.message}`
        );

        return;
      }

      if (formData.is_active) {
        const deactivateError =
          await deactivateOtherSettings(editingId);

        if (deactivateError) {
          toast.warning(
            "La configuración se actualizó, pero no se pudieron desactivar automáticamente las demás."
          );
        }
      }

      setLoading(false);

      toast.success(
        "Configuración actualizada correctamente."
      );

      resetForm();
      await loadData();
      return;
    }

    const { data, error } = await supabase
      .from("commission_settings")
      .insert([payload])
      .select()
      .single();

    if (error || !data) {
      setLoading(false);

      toast.error(
        `Error al guardar configuración: ${
          error?.message ||
          "No se pudo obtener la configuración creada."
        }`
      );

      return;
    }

    if (formData.is_active) {
      const deactivateError =
        await deactivateOtherSettings(data.id);

      if (deactivateError) {
        toast.warning(
          "La configuración fue creada, pero no se pudieron desactivar automáticamente las demás."
        );
      }
    }

    setEditingId(data.id);
    setLoading(false);

    toast.success(
      "Configuración guardada. Ahora podés cargar sus objetivos."
    );

    await loadData();
  };

  const handleAddTarget = async () => {
    if (!editingId) {
      toast.warning(
        "Primero guardá la configuración mensual."
      );
      return;
    }

    const installationsGoal = Number(
      targetForm.installations_goal
    );

    const bonusAmount = Number(
      targetForm.bonus_amount
    );

    if (
      !targetForm.installations_goal ||
      Number.isNaN(installationsGoal) ||
      installationsGoal <= 0
    ) {
      toast.warning(
        "Ingresá una cantidad de instalaciones mayor a cero."
      );
      return;
    }

    if (
      !targetForm.bonus_amount ||
      Number.isNaN(bonusAmount) ||
      bonusAmount <= 0
    ) {
      toast.warning(
        "Ingresá un bono mayor a cero."
      );
      return;
    }

    const duplicatedTarget = currentTargets.some(
      (target) =>
        target.installations_goal ===
        installationsGoal
    );

    if (duplicatedTarget) {
      toast.warning(
        `Ya existe un objetivo de ${installationsGoal} instalaciones para este período.`
      );
      return;
    }

    setLoadingTarget(true);

    const { error } = await supabase
      .from("commission_targets")
      .insert([
        {
          commission_setting_id: editingId,
          installations_goal:
            installationsGoal,
          bonus_amount: bonusAmount,
        },
      ]);

    setLoadingTarget(false);

    if (error) {
      toast.error(
        `Error al guardar objetivo: ${error.message}`
      );
      return;
    }

    toast.success(
      "Objetivo agregado correctamente."
    );

    setTargetForm(initialTarget);
    await loadData();
  };

  const handleDeleteTarget = async (
    id: string
  ) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar este objetivo?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("commission_targets")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(
        `Error al eliminar objetivo: ${error.message}`
      );
      return;
    }

    toast.success("Objetivo eliminado.");
    await loadData();
  };

  const handleEditSetting = (
    setting: CommissionSetting
  ) => {
    setEditingId(setting.id);

    setFormData({
      year: setting.year,
      month: setting.month,
      base_amount_per_installation: String(
        setting.base_amount_per_installation
      ),
      notes: setting.notes || "",
      is_active: setting.is_active,
    });

    setTargetForm(initialTarget);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

const handleDeleteSetting = async () => {
  if (!deleteSettingId) return;

  const settingToDelete = settings.find(
    (setting) => setting.id === deleteSettingId
  );

  if (!settingToDelete) {
    toast.error(
      "No se pudo identificar la configuración seleccionada."
    );
    return;
  }

  setDeletingSetting(true);

  try {
    const {
      error: targetsError,
    } = await supabase
      .from("commission_targets")
      .delete()
      .eq(
        "commission_setting_id",
        deleteSettingId
      );

    if (targetsError) {
      toast.error(
        `No se pudieron eliminar los objetivos: ${targetsError.message}`
      );
      return;
    }

    const {
      data: deletedSettings,
      error: settingError,
    } = await supabase
      .from("commission_settings")
      .delete()
      .eq("id", deleteSettingId)
      .select("id");

    if (settingError) {
      toast.error(
        `No se pudo eliminar la configuración: ${settingError.message}`
      );
      return;
    }

    if (
      !deletedSettings ||
      deletedSettings.length === 0
    ) {
      toast.error(
        "Supabase no eliminó la configuración."
      );
      return;
    }

    if (editingId === deleteSettingId) {
      resetForm();
    }

    setSettings((previous) =>
      previous.filter(
        (setting) =>
          setting.id !== deleteSettingId
      )
    );

    setTargets((previous) =>
      previous.filter(
        (target) =>
          target.commission_setting_id !==
          deleteSettingId
      )
    );

    toast.success(
      `La configuración de ${monthLabel(
        settingToDelete.month
      )} ${settingToDelete.year} fue eliminada.`
    );

    setDeleteSettingId(null);
    await loadData();
  } finally {
    setDeletingSetting(false);
  }
};

  const filteredSettings = useMemo(() => {
    const text = search.trim().toLowerCase();

    return settings.filter((setting) => {
      if (!text) return true;

      return (
        String(setting.year).includes(text) ||
        String(setting.month).includes(text) ||
        monthLabel(setting.month)
          .toLowerCase()
          .includes(text) ||
        formatMoney(
          setting.base_amount_per_installation
        )
          .toLowerCase()
          .includes(text) ||
        (setting.notes || "")
          .toLowerCase()
          .includes(text) ||
        (setting.is_active
          ? "activa"
          : "inactiva"
        ).includes(text)
      );
    });
  }, [settings, search]);

  const currentTargets = editingId
    ? getTargetsForSetting(editingId)
    : [];

  const selectedSetting = useMemo(() => {
    if (!editingId) return null;

    return (
      settings.find(
        (setting) => setting.id === editingId
      ) || null
    );
  }, [editingId, settings]);

  const activeSetting = useMemo(() => {
    return (
      settings.find(
        (setting) => setting.is_active
      ) || null
    );
  }, [settings]);

  if (loadingInitialData) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando configuraciones de
            comisiones...
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
          Comisiones
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500 md:leading-normal">
          Configurá los importes, objetivos y
          bonificaciones para cada período.
        </p>
      </div>

      {/* RESUMEN ACTIVO */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-950">
              Plan de comisiones vigente
            </p>

            {activeSetting ? (
              <>
                <p className="mt-1 text-sm leading-6 text-blue-800">
                  {monthLabel(
                    activeSetting.month
                  )}{" "}
                  {activeSetting.year} · Base por
                  instalación{" "}
                  <span className="font-semibold">
                    {formatMoney(
                      activeSetting.base_amount_per_installation
                    )}
                  </span>
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-700">
                  Tiene{" "}
                  {
                    getTargetsForSetting(
                      activeSetting.id
                    ).length
                  }{" "}
                  objetivo
                  {getTargetsForSetting(
                    activeSetting.id
                  ).length === 1
                    ? ""
                    : "s"}{" "}
                  configurado
                  {getTargetsForSetting(
                    activeSetting.id
                  ).length === 1
                    ? ""
                    : "s"}
                  .
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm leading-6 text-blue-800">
                No hay una configuración activa en
                este momento.
              </p>
            )}
          </div>

          <span className="w-fit shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
            Solo una configuración activa
          </span>
        </div>
      </div>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* CONFIGURACIÓN */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  {editingId
                    ? "Editar configuración mensual"
                    : "Nueva configuración mensual"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {selectedSetting
                    ? `Estás modificando el período ${monthLabel(
                        selectedSetting.month
                      )} ${selectedSetting.year}.`
                    : "Definí el importe por instalación y el período de vigencia."}
                </p>
              </div>

              {editingId && (
                <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Modo edición
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* PERÍODO */}
            <FormSection
              number="1"
              title="Período"
              description="Seleccioná el mes y el año al que corresponde esta configuración."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Año">
                  <input
                    type="number"
                    min="2020"
                    max="2100"
                    className={inputClass}
                    value={formData.year}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        year: Number(
                          event.target.value
                        ),
                      }))
                    }
                    disabled={loading}
                  />
                </Field>

                <Field label="Mes">
                  <select
                    className={inputClass}
                    value={formData.month}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        month: Number(
                          event.target.value
                        ),
                      }))
                    }
                    disabled={loading}
                  >
                    {Array.from(
                      { length: 12 },
                      (_, index) => index + 1
                    ).map((month) => (
                      <option
                        key={month}
                        value={month}
                      >
                        {monthLabel(month)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      is_active:
                        event.target.checked,
                    }))
                  }
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />

                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    Configuración activa
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Al activarla, las demás
                    configuraciones vigentes pasarán
                    automáticamente a estado
                    inactivo.
                  </span>
                </span>
              </label>
            </FormSection>

            {/* COMISIÓN */}
            <FormSection
              number="2"
              title="Comisión base"
              description="Definí el importe que recibe el vendedor por cada instalación completada."
              bordered
            >
              <div className="space-y-4">
                <Field label="Monto base por instalación">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                      $
                    </span>

                    <input
                      type="text"
                      inputMode="numeric"
                      className={`${inputClass} pl-7`}
                      value={formatAmountInput(
                        formData.base_amount_per_installation
                      )}
                      onChange={(event) =>
                        setFormData((previous) => ({
                          ...previous,
                          base_amount_per_installation:
                            parseAmountInput(event.target.value),
                        }))
                      }
                      placeholder="Ej: 15.000"
                      disabled={loading}
                    />
                  </div>
                </Field>

                <Field label="Observaciones">
                  <textarea
                    className={`${inputClass} min-h-24 resize-y`}
                    rows={3}
                    value={formData.notes}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        notes:
                          event.target.value,
                      }))
                    }
                    placeholder="Notas internas sobre esta configuración..."
                    disabled={loading}
                  />
                </Field>
              </div>
            </FormSection>

            {/* ACCIONES CONFIGURACIÓN */}
            <div className="border-t border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loading
                    ? "Guardando..."
                    : editingId
                      ? "Actualizar configuración"
                      : "Guardar configuración"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {editingId
                    ? "Cancelar"
                    : "Limpiar"}
                </button>
              </div>
            </div>
          </form>

          {/* OBJETIVOS */}
          <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-5 md:px-6 md:py-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
                3
              </div>

              <div>
                <h3 className="text-base font-semibold text-slate-950 md:text-lg">
                  Objetivos y bonos
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
                  Agregá los premios adicionales
                  según la cantidad de instalaciones
                  alcanzadas.
                </p>
              </div>
            </div>

            {!editingId ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Primero guardá la configuración
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Después de crear el período podrás
                  cargar sus objetivos y bonos.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cantidad de instalaciones">
                    <input
                      type="number"
                      min="1"
                      className={inputClass}
                      value={
                        targetForm.installations_goal
                      }
                      onChange={(event) =>
                        setTargetForm(
                          (previous) => ({
                            ...previous,
                            installations_goal:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="Ej: 10"
                      disabled={loadingTarget}
                    />
                  </Field>

                  <Field label="Bono extra">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                        $
                      </span>

                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${inputClass} pl-7`}
                        value={formatAmountInput(
                          targetForm.bonus_amount
                        )}
                        onChange={(event) =>
                          setTargetForm((previous) => ({
                            ...previous,
                            bonus_amount:
                              parseAmountInput(event.target.value),
                          }))
                        }
                        placeholder="Ej: 50.000"
                        disabled={loadingTarget}
                      />
                    </div>
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={handleAddTarget}
                  disabled={loadingTarget}
                  className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loadingTarget
                    ? "Agregando..."
                    : "Agregar objetivo"}
                </button>

                <div className="mt-5 space-y-3">
                  {currentTargets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
                      <p className="text-sm text-slate-500">
                        Todavía no hay objetivos
                        cargados para este período.
                      </p>
                    </div>
                  ) : (
                    currentTargets.map(
                      (target, index) => (
                        <div
                          key={target.id}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                                {index + 1}
                              </div>

                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                  Objetivo
                                </p>

                                <p className="mt-0.5 font-semibold text-slate-950">
                                  {
                                    target.installations_goal
                                  }{" "}
                                  instalaciones
                                </p>

                                <p className="mt-1 text-sm text-slate-600">
                                  Bono{" "}
                                  <span className="font-semibold text-emerald-700">
                                    {formatMoney(
                                      target.bonus_amount
                                    )}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteTarget(
                                  target.id
                                )
                              }
                              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 sm:w-auto"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* LISTADO */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  Configuraciones
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredSettings.length} de{" "}
                  {settings.length} configuraciones
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Total: {settings.length}
              </span>
            </div>

            <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                type="text"
                className={`${inputClass} min-w-0`}
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar por año, mes, monto, estado o nota..."
              />

              <button
                type="button"
                onClick={() => setSearch("")}
                className="w-full whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-4">
            {filteredSettings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-500">
                  {settings.length === 0
                    ? "No hay configuraciones registradas."
                    : "No se encontraron configuraciones con esa búsqueda."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSettings.map(
                  (setting) => {
                    const settingTargets =
                      getTargetsForSetting(
                        setting.id
                      );

                    const isSelected =
                      editingId === setting.id;

                    return (
                      <article
                        key={setting.id}
                        className={`rounded-xl border p-4 transition ${
                          isSelected
                            ? "border-blue-300 bg-blue-50/40 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-slate-950">
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

                            <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                              Base por instalación
                            </p>

                            <p className="mt-0.5 text-lg font-bold text-slate-950">
                              {formatMoney(
                                setting.base_amount_per_installation
                              )}
                            </p>
                          </div>
                        </div>

                        {setting.notes && (
                          <div className="mt-4 rounded-lg bg-slate-50 p-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              Observaciones
                            </p>

                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                              {setting.notes}
                            </p>
                          </div>
                        )}

                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Objetivos
                            </p>

                            <span className="text-xs text-slate-400">
                              {
                                settingTargets.length
                              }{" "}
                              configurado
                              {settingTargets.length ===
                              1
                                ? ""
                                : "s"}
                            </span>
                          </div>

                          {settingTargets.length ===
                          0 ? (
                            <p className="mt-2 text-xs text-slate-400">
                              Sin objetivos cargados.
                            </p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {settingTargets.map(
                                (target) => (
                                  <div
                                    key={target.id}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                                  >
                                    <span className="text-xs font-medium text-slate-700">
                                      {
                                        target.installations_goal
                                      }{" "}
                                      instalaciones
                                    </span>

                                    <span className="text-xs font-semibold text-emerald-700">
                                      {formatMoney(
                                        target.bonus_amount
                                      )}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() =>
                              handleEditSetting(
                                setting
                              )
                            }
                            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
                          >
                            {isSelected
                              ? "Editando"
                              : "Editar"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteSettingId(setting.id)
                              }
                            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 sm:w-auto"
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
                setting.id === deleteSettingId
            ) || null
          }
          deleting={deletingSetting}
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
  setting: CommissionSetting | null;
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
            ¿Querés eliminar la configuración de{" "}
            <span className="font-semibold text-slate-950">
              {monthLabel(setting.month)}{" "}
              {setting.year}
            </span>
            ?
          </p>

          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              También se eliminarán todos los
              objetivos y bonos asociados.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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