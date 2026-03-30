"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

export default function ComisionesClient() {
  const supabase = createClient();

  const [settings, setSettings] = useState<CommissionSetting[]>([]);
  const [targets, setTargets] = useState<CommissionTarget[]>([]);
  const [formData, setFormData] = useState(initialForm);
  const [targetForm, setTargetForm] = useState(initialTarget);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = async () => {
    const [settingsRes, targetsRes] = await Promise.all([
      supabase
        .from("commission_settings")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
      supabase
        .from("commission_targets")
        .select("*")
        .order("installations_goal", { ascending: true }),
    ]);

    if (settingsRes.error) {
      console.error(
        "Error al cargar configuraciones:",
        settingsRes.error.message
      );
    } else {
      setSettings(settingsRes.data || []);
    }

    if (targetsRes.error) {
      console.error("Error al cargar objetivos:", targetsRes.error.message);
    } else {
      setTargets(targetsRes.data || []);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const formatMoney = (value: number | string | null) => {
    const numberValue = Number(value || 0);
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    }).format(numberValue);
  };

  const resetForm = () => {
    setFormData(initialForm);
    setTargetForm(initialTarget);
    setEditingId(null);
  };

  const getTargetsForSetting = (settingId: string) => {
    return targets
      .filter((t) => t.commission_setting_id === settingId)
      .sort((a, b) => a.installations_goal - b.installations_goal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.year || !formData.month) {
      alert("Debés completar año y mes.");
      return;
    }

    if (!formData.base_amount_per_installation) {
      alert("Debés ingresar el monto base por instalación.");
      return;
    }

    setLoading(true);

    const payload = {
      year: Number(formData.year),
      month: Number(formData.month),
      base_amount_per_installation: Number(formData.base_amount_per_installation),
      notes: formData.notes || null,
      is_active: formData.is_active,
    };

    if (editingId) {
      const { error } = await supabase
        .from("commission_settings")
        .update(payload)
        .eq("id", editingId);

      setLoading(false);

      if (error) {
        alert(`Error al actualizar configuración: ${error.message}`);
        console.error(error);
        return;
      }

      resetForm();
      await loadData();
      return;
    }

    const { data, error } = await supabase
      .from("commission_settings")
      .insert([payload])
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert(`Error al guardar configuración: ${error.message}`);
      console.error(error);
      return;
    }

    setEditingId(data.id);
    await loadData();
    alert("Configuración guardada. Ahora podés cargar objetivos.");
  };

  const handleAddTarget = async () => {
    if (!editingId) {
      alert("Primero guardá la configuración mensual.");
      return;
    }

    if (!targetForm.installations_goal || !targetForm.bonus_amount) {
      alert("Completá cantidad de instalaciones y bono.");
      return;
    }

    const { error } = await supabase.from("commission_targets").insert([
      {
        commission_setting_id: editingId,
        installations_goal: Number(targetForm.installations_goal),
        bonus_amount: Number(targetForm.bonus_amount),
      },
    ]);

    if (error) {
      alert(`Error al guardar objetivo: ${error.message}`);
      console.error(error);
      return;
    }

    setTargetForm(initialTarget);
    await loadData();
  };

  const handleDeleteTarget = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar este objetivo?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("commission_targets")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`Error al eliminar objetivo: ${error.message}`);
      console.error(error);
      return;
    }

    await loadData();
  };

  const handleEditSetting = (setting: CommissionSetting) => {
    setEditingId(setting.id);
    setFormData({
      year: setting.year,
      month: setting.month,
      base_amount_per_installation: String(setting.base_amount_per_installation),
      notes: setting.notes || "",
      is_active: setting.is_active,
    });
    setTargetForm(initialTarget);
  };

  const handleDeleteSetting = async (id: string) => {
    const confirmed = window.confirm(
      "¿Seguro que querés eliminar esta configuración y todos sus objetivos?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("commission_settings")
      .delete()
      .eq("id", id);

    if (error) {
      alert(`Error al eliminar configuración: ${error.message}`);
      console.error(error);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadData();
  };

  const filteredSettings = useMemo(() => {
    const text = search.trim().toLowerCase();

    return settings.filter((setting) => {
      if (!text) return true;

      return (
        String(setting.year).includes(text) ||
        String(setting.month).includes(text) ||
        monthLabel(setting.month).toLowerCase().includes(text) ||
        formatMoney(setting.base_amount_per_installation)
          .toLowerCase()
          .includes(text) ||
        (setting.notes || "").toLowerCase().includes(text)
      );
    });
  }, [settings, search]);

  const currentTargets = editingId ? getTargetsForSetting(editingId) : [];

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">Comisiones</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold mb-4">
            {editingId
              ? "Editar configuración mensual"
              : "Nueva configuración mensual"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Año</label>
                <input
                  type="number"
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.year}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      year: Number(e.target.value),
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Mes</label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={formData.month}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      month: Number(e.target.value),
                    }))
                  }
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>
                      {monthLabel(month)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">
                Monto base por instalación
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-md border px-3 py-2"
                value={formData.base_amount_per_installation}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    base_amount_per_installation: e.target.value,
                  }))
                }
                placeholder="Ej: 8500"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Observaciones</label>
              <textarea
                className="w-full rounded-md border px-3 py-2"
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Notas de la configuración del mes"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
              />
              <label htmlFor="is_active" className="text-sm">
                Configuración activa
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-black px-4 py-2 text-white"
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
                className="rounded-md border px-4 py-2"
              >
                Limpiar
              </button>
            </div>
          </form>

          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">Objetivos del mes</h3>

            {!editingId ? (
              <p className="text-sm text-slate-500">
                Primero guardá la configuración mensual para poder agregar objetivos.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">
                      Cantidad de instalaciones
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border px-3 py-2"
                      value={targetForm.installations_goal}
                      onChange={(e) =>
                        setTargetForm((prev) => ({
                          ...prev,
                          installations_goal: e.target.value,
                        }))
                      }
                      placeholder="Ej: 10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Bono extra</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-md border px-3 py-2"
                      value={targetForm.bonus_amount}
                      onChange={(e) =>
                        setTargetForm((prev) => ({
                          ...prev,
                          bonus_amount: e.target.value,
                        }))
                      }
                      placeholder="Ej: 50000"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleAddTarget}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-white"
                  >
                    Agregar objetivo
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {currentTargets.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Todavía no hay objetivos cargados.
                    </p>
                  ) : (
                    currentTargets.map((target) => (
                      <div
                        key={target.id}
                        className="rounded-lg border p-3 flex items-center justify-between"
                      >
                        <div className="text-sm">
                          <p>
                            Objetivo:{" "}
                            <span className="font-semibold">
                              {target.installations_goal} instalaciones
                            </span>
                          </p>
                          <p>
                            Bono:{" "}
                            <span className="font-semibold">
                              {formatMoney(target.bonus_amount)}
                            </span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTarget(target.id)}
                          className="rounded-md bg-red-600 px-3 py-1 text-xs text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow flex flex-col">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <h2 className="text-xl font-semibold">Configuraciones</h2>
              <p className="text-sm text-slate-500">
                {filteredSettings.length} de {settings.length} configuraciones
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por año, mes, monto o nota..."
            />

            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-md border px-3 py-2 text-sm whitespace-nowrap"
            >
              Limpiar
            </button>
          </div>

          {filteredSettings.length === 0 ? (
            <p className="text-gray-500">
              {settings.length === 0
                ? "No hay configuraciones cargadas."
                : "No se encontraron configuraciones con esa búsqueda."}
            </p>
          ) : (
            <div className="flex-1 overflow-auto max-h-[650px] pr-2 space-y-3">
              {filteredSettings.map((setting) => {
                const settingTargets = getTargetsForSetting(setting.id);

                return (
                  <div key={setting.id} className="rounded-lg border p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-semibold text-sm">
                          {monthLabel(setting.month)} {setting.year}
                        </p>
                        <p className="text-sm text-slate-600">
                          Base por instalación:{" "}
                          <span className="font-semibold">
                            {formatMoney(setting.base_amount_per_installation)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Estado: {setting.is_active ? "Activa" : "Inactiva"}
                        </p>
                        {setting.notes && (
                          <p className="text-xs text-slate-500 mt-1">
                            Nota: {setting.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditSetting(setting)}
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSetting(setting.id)}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs text-white"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-600 mb-1">
                        Objetivos:
                      </p>

                      {settingTargets.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          Sin objetivos cargados
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {settingTargets.map((target) => (
                            <div
                              key={target.id}
                              className="text-xs text-slate-600"
                            >
                              {target.installations_goal} instalaciones →{" "}
                              {formatMoney(target.bonus_amount)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}