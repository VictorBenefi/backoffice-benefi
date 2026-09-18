"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type MerchantGroup = {
  id: string;
  name: string;
  legal_name: string | null;
  cuit: string | null;
  is_partner: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type FormData = {
  name: string;
  legal_name: string;
  cuit: string;
  is_partner: boolean;
};

const emptyForm: FormData = {
  name: "",
  legal_name: "",
  cuit: "",
  is_partner: false,
};

export default function GruposPage() {
  const [groups, setGroups] = useState<
    MerchantGroup[]
  >([]);

  const [formData, setFormData] =
    useState<FormData>(emptyForm);

  const [editingGroupId, setEditingGroupId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error">(
      "success"
    );

  const loadGroups = useCallback(
    async () => {
      setLoading(true);

      try {
        const response = await fetch(
          "/api/merchant-groups",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "No se pudieron cargar los grupos."
          );
        }

        setGroups(
          (data.groups ||
            []) as MerchantGroup[]
        );
      } catch (error) {
        setMessageType("error");

        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los grupos."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const resetForm = () => {
    setEditingGroupId(null);
    setFormData(emptyForm);
  };

  const startEditing = (
    group: MerchantGroup
  ) => {
    setEditingGroupId(group.id);

    setFormData({
      name: group.name,
      legal_name:
        group.legal_name || "",
      cuit: group.cuit || "",
      is_partner:
        group.is_partner || false,
    });

    setMessage("");
  };

  const cancelEditing = () => {
    resetForm();
    setMessage("");
  };

  const handleSubmit = async (
    event: React.FormEvent
   ) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setMessageType("error");
      setMessage(
        "Debés ingresar el nombre del grupo."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const isEditing =
        Boolean(editingGroupId);

      const response = await fetch(
        "/api/merchant-groups",
        {
          method: isEditing
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            ...(editingGroupId
              ? {
                  id: editingGroupId,
                }
              : {}),
            name: formData.name,
            legal_name:
              formData.legal_name,
            cuit: formData.cuit,
            is_partner:
              formData.is_partner,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (isEditing
              ? "No se pudo actualizar el grupo."
              : "No se pudo crear el grupo.")
        );
      }

      resetForm();

      setMessageType("success");

      setMessage(
        isEditing
          ? "Grupo actualizado correctamente."
          : "Grupo creado correctamente."
      );

      await loadGroups();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el grupo."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleGroupStatus = async (
    group: MerchantGroup
  ) => {
    const newStatus =
      !group.is_active;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/merchant-groups",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: group.id,
            is_active: newStatus,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo actualizar el estado del grupo."
        );
      }

      if (
        editingGroupId === group.id &&
        !newStatus
      ) {
        resetForm();
      }

      setMessageType("success");

      setMessage(
        newStatus
          ? "Grupo activado correctamente."
          : "Grupo inactivado correctamente."
      );

      await loadGroups();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado del grupo."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Grupos
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Administración de empresas o grupos
          comerciales que pueden contener una o
          más marcas.
        </p>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">
              {editingGroupId
                ? "Editar grupo"
                : "Nuevo grupo"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editingGroupId
                ? "Modificá los datos del grupo seleccionado."
                : "Registrá la empresa o grupo comercial."}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 p-5"
          >
            <Field
              label="Nombre del grupo"
              required
            >
              <input
                type="text"
                className={inputClass}
                value={formData.name}
                onChange={(event) =>
                  setFormData(
                    (previous) => ({
                      ...previous,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="Ej: Grupo Bonacina"
              />
            </Field>

            <Field label="Razón social">
              <input
                type="text"
                className={inputClass}
                value={
                  formData.legal_name
                }
                onChange={(event) =>
                  setFormData(
                    (previous) => ({
                      ...previous,
                      legal_name:
                        event.target.value,
                    })
                  )
                }
                placeholder="Ej: Grupo Bonacina S.A."
              />
            </Field>

            <Field label="CUIT">
              <input
                type="text"
                className={inputClass}
                value={formData.cuit}
                onChange={(event) =>
                  setFormData(
                    (previous) => ({
                      ...previous,
                      cuit:
                        event.target.value,
                    })
                  )
                }
                placeholder="30-12345678-9"
              />
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.is_partner}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      is_partner:
                        event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Este grupo es Partner
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Permite configurar comisiones sobre las operaciones
                    de los comercios pertenecientes al grupo.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving
                  ? "Guardando..."
                  : editingGroupId
                    ? "Guardar cambios"
                    : "Guardar grupo"}
              </button>

              {editingGroupId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={
                    cancelEditing
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Grupos registrados
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {groups.length}{" "}
              {groups.length === 1
                ? "grupo"
                : "grupos"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Cargando grupos...
            </div>
          ) : groups.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay grupos registrados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {group.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {group.legal_name ||
                          "Sin razón social"}
                      </p>
                    </div>

                    <span
                      className={
                        group.is_active
                          ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      }
                    >
                      {group.is_active
                        ? "Activo"
                        : "Inactivo"}
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-slate-600">
                    <span className="text-slate-500">
                      CUIT:{" "}
                    </span>

                    <span className="font-medium text-slate-800">
                      {group.cuit || "-"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        startEditing(
                          group
                        )
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        toggleGroupStatus(
                          group
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                        group.is_active
                          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {group.is_active
                        ? "Inactivar"
                        : "Activar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}