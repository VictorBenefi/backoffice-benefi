"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type MerchantGroup = {
  id: string;
  name: string;
  is_active: boolean;
};

type MerchantBrand = {
  id: string;
  merchant_group_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  merchant_groups:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type FormData = {
  merchant_group_id: string;
  name: string;
};

const emptyForm: FormData = {
  merchant_group_id: "",
  name: "",
};

export default function MarcasPage() {
  const [brands, setBrands] = useState<
    MerchantBrand[]
  >([]);

  const [groups, setGroups] = useState<
    MerchantGroup[]
  >([]);

  const [formData, setFormData] =
    useState<FormData>(emptyForm);

  const [editingBrandId, setEditingBrandId] =
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

  const activeGroups = useMemo(
    () =>
      groups.filter(
        (group) => group.is_active
      ),
    [groups]
  );

  const loadData = useCallback(
    async () => {
      setLoading(true);

      try {
        const [
          brandsResponse,
          groupsResponse,
        ] = await Promise.all([
          fetch(
            "/api/merchant-brands",
            {
              method: "GET",
              cache: "no-store",
            }
          ),
          fetch(
            "/api/merchant-groups",
            {
              method: "GET",
              cache: "no-store",
            }
          ),
        ]);

        const brandsData =
          await brandsResponse.json();

        const groupsData =
          await groupsResponse.json();

        if (!brandsResponse.ok) {
          throw new Error(
            brandsData.error ||
              "No se pudieron cargar las marcas."
          );
        }

        if (!groupsResponse.ok) {
          throw new Error(
            groupsData.error ||
              "No se pudieron cargar los grupos."
          );
        }

        setBrands(
          (brandsData.brands ||
            []) as MerchantBrand[]
        );

        setGroups(
          (groupsData.groups ||
            []) as MerchantGroup[]
        );
      } catch (error) {
        setMessageType("error");

        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los datos."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingBrandId(null);
    setFormData(emptyForm);
  };

  const startEditing = (
    brand: MerchantBrand
  ) => {
    setEditingBrandId(brand.id);

    setFormData({
      merchant_group_id:
        brand.merchant_group_id,
      name: brand.name,
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

    if (
      !formData.merchant_group_id
    ) {
      setMessageType("error");
      setMessage(
        "Debés seleccionar un grupo."
      );
      return;
    }

    if (!formData.name.trim()) {
      setMessageType("error");
      setMessage(
        "Debés ingresar el nombre de la marca."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const isEditing =
        Boolean(editingBrandId);

      const response = await fetch(
        "/api/merchant-brands",
        {
          method: isEditing
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            ...(editingBrandId
              ? {
                  id: editingBrandId,
                }
              : {}),
            merchant_group_id:
              formData.merchant_group_id,
            name: formData.name,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (isEditing
              ? "No se pudo actualizar la marca."
              : "No se pudo crear la marca.")
        );
      }

      resetForm();

      setMessageType("success");

      setMessage(
        isEditing
          ? "Marca actualizada correctamente."
          : "Marca creada correctamente."
      );

      await loadData();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la marca."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleBrandStatus = async (
    brand: MerchantBrand
  ) => {
    const newStatus =
      !brand.is_active;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/merchant-brands",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: brand.id,
            is_active: newStatus,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo actualizar el estado de la marca."
        );
      }

      if (
        editingBrandId === brand.id &&
        !newStatus
      ) {
        resetForm();
      }

      setMessageType("success");

      setMessage(
        newStatus
          ? "Marca activada correctamente."
          : "Marca inactivada correctamente."
      );

      await loadData();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado de la marca."
      );
    } finally {
      setSaving(false);
    }
  };

  const getGroupName = (
    brand: MerchantBrand
  ) => {
    if (
      Array.isArray(
        brand.merchant_groups
      )
    ) {
      return (
        brand.merchant_groups[0]
          ?.name ||
        "Grupo no disponible"
      );
    }

    return (
      brand.merchant_groups?.name ||
      "Grupo no disponible"
    );
  };

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
          Marcas
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Administración de marcas
          comerciales asociadas a un grupo.
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
              {editingBrandId
                ? "Editar marca"
                : "Nueva marca"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editingBrandId
                ? "Modificá los datos de la marca seleccionada."
                : "Registrá una marca dentro de un grupo comercial."}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 p-5"
          >
            <Field
              label="Grupo"
              required
            >
              <select
                className={inputClass}
                value={
                  formData.merchant_group_id
                }
                onChange={(event) =>
                  setFormData(
                    (previous) => ({
                      ...previous,
                      merchant_group_id:
                        event.target.value,
                    })
                  )
                }
              >
                <option value="">
                  Seleccionar grupo
                </option>

                {activeGroups.map(
                  (group) => (
                    <option
                      key={group.id}
                      value={group.id}
                    >
                      {group.name}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field
              label="Nombre de la marca"
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
                placeholder="Ej: Bonafide"
              />
            </Field>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving
                  ? "Guardando..."
                  : editingBrandId
                    ? "Guardar cambios"
                    : "Guardar marca"}
              </button>

              {editingBrandId && (
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
              Marcas registradas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {brands.length}{" "}
              {brands.length === 1
                ? "marca"
                : "marcas"}
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Cargando marcas...
            </div>
          ) : brands.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay marcas registradas.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {brands.map((brand) => (
                <div
                  key={brand.id}
                  className="p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {brand.name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Grupo:{" "}
                        {getGroupName(
                          brand
                        )}
                      </p>
                    </div>

                    <span
                      className={
                        brand.is_active
                          ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      }
                    >
                      {brand.is_active
                        ? "Activo"
                        : "Inactivo"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        startEditing(
                          brand
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
                        toggleBrandStatus(
                          brand
                        )
                      }
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                        brand.is_active
                          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {brand.is_active
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