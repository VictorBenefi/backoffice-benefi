"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Vendor = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  zone: string | null;
  created_at: string;
  is_active: boolean | null;
};

const initialForm = {
  phone: "",
  zone: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 md:py-2.5";

export default function VendedoresPage() {
  const supabase = useMemo(() => createClient(), []);

  const [formData, setFormData] = useState(initialForm);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadVendors = async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(`Error al cargar vendedores: ${error.message}`);
      return;
    }

    setVendors((data as Vendor[]) || []);
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoadingInitialData(true);

      try {
        await loadVendors();
      } finally {
        setLoadingInitialData(false);
      }
    };

    loadInitialData();
  }, []);

  const handleChange = (
    field: keyof typeof initialForm,
    value: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);

    setFormData({
      phone: vendor.phone || "",
      zone: vendor.zone || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!editingId) {
      toast.warning("Seleccioná un vendedor para editar.");
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("vendors")
      .update({
        phone: formData.phone.trim() || null,
        zone: formData.zone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);

    setLoading(false);

    if (error) {
      toast.error(
        `Error al actualizar vendedor: ${error.message}`
      );
      return;
    }

    toast.success("Datos actualizados correctamente.");

    resetForm();
    await loadVendors();
  };

  const filteredVendors = useMemo(() => {
    const text = search.trim().toLowerCase();

    return vendors.filter((vendor) => {
      if (!text) return true;

      return (
        (vendor.name || "")
          .toLowerCase()
          .includes(text) ||
        (vendor.email || "")
          .toLowerCase()
          .includes(text) ||
        (vendor.phone || "")
          .toLowerCase()
          .includes(text) ||
        (vendor.zone || "")
          .toLowerCase()
          .includes(text)
      );
    });
  }, [vendors, search]);

  const selectedVendor = useMemo(() => {
    if (!editingId) return null;

    return (
      vendors.find(
        (vendor) => vendor.id === editingId
      ) || null
    );
  }, [vendors, editingId]);

  if (loadingInitialData) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando vendedores...
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
          Vendedores
        </h1>

        <p className="mt-1 text-sm leading-6 text-slate-500 md:leading-normal">
          Administrá la información complementaria de los
          vendedores registrados en el sistema.
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* FORMULARIO */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  {selectedVendor
                    ? `Editar: ${
                        selectedVendor.name ||
                        "Vendedor sin nombre"
                      }`
                    : "Editar vendedor"}
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {selectedVendor
                    ? "Completá o actualizá los datos comerciales del vendedor seleccionado."
                    : "Seleccioná un vendedor del listado para completar o actualizar sus datos."}
                </p>
              </div>

              {editingId && (
                <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Modo edición
                </span>
              )}
            </div>
          </div>

          <div className="border-b border-blue-100 bg-blue-50 px-4 py-4 md:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                i
              </div>

              <div>
                <p className="text-sm font-semibold text-blue-950">
                  Información
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-800 md:text-sm">
                  Los vendedores se crean automáticamente
                  desde el módulo Usuarios. En esta pantalla
                  únicamente se completan sus datos de
                  contacto y zona comercial.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-4 py-5 md:px-6 md:py-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white md:h-8 md:w-8 md:text-sm">
                  1
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-950 md:text-lg">
                    Datos comerciales
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
                    Información complementaria del vendedor.
                  </p>
                </div>
              </div>

              <div className="space-y-4">

                <Field label="Nombre">
                  <input
                    type="text"
                    className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                    value={selectedVendor?.name || ""}
                    placeholder="Sin nombre registrado"
                    disabled
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                    value={selectedVendor?.email || ""}
                    placeholder="Sin email registrado"
                    disabled
                  />
                </Field>
                
                <Field label="Teléfono">
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.phone}
                    onChange={(event) =>
                      handleChange(
                        "phone",
                        event.target.value
                      )
                    }
                    placeholder="Ej: 387..."
                    disabled={!editingId || loading}
                  />
                </Field>

                <Field label="Zona">
                  <input
                    type="text"
                    className={inputClass}
                    value={formData.zone}
                    onChange={(event) =>
                      handleChange(
                        "zone",
                        event.target.value
                      )
                    }
                    placeholder="Ej: Salta Centro"
                    disabled={!editingId || loading}
                  />
                </Field>
              </div>

              {!editingId && (
                <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">
                    No hay un vendedor seleccionado
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Presioná Editar en una tarjeta del listado
                    para habilitar el formulario.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading || !editingId}
                  className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loading
                    ? "Guardando..."
                    : "Guardar cambios"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={loading}
                    className="w-full rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>

        {/* LISTADO */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
          <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                  Vendedores registrados
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {filteredVendors.length} de{" "}
                  {vendors.length} vendedores
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Total: {vendors.length}
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
                placeholder="Buscar por nombre, email, teléfono o zona..."
              />

              <button
                type="button"
                onClick={() => setSearch("")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-240px)] overflow-y-auto p-4">
            {filteredVendors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                <p className="text-sm text-slate-500">
                  {vendors.length === 0
                    ? "No hay vendedores registrados."
                    : "No se encontraron vendedores con esa búsqueda."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVendors.map((vendor) => {
                  const isSelected =
                    editingId === vendor.id;

                  return (
                    <article
                      key={vendor.id}
                      className={`rounded-xl border p-4 transition ${
                        isSelected
                          ? "border-blue-300 bg-blue-50/40 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-950">
                            {vendor.name || "Sin nombre"}
                          </h3>

                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {vendor.email ||
                              "Sin email registrado"}
                          </p>
                        </div>

                        <StatusBadge
                          active={Boolean(
                            vendor.is_active
                          )}
                        />
                      </div>

                      <dl className="mt-4 grid gap-2 text-xs">
                        <VendorDetail
                          label="Teléfono"
                          value={vendor.phone || "-"}
                        />

                        <VendorDetail
                          label="Zona"
                          value={vendor.zone || "-"}
                        />

                        <VendorDetail
                          label="Creado"
                          value={formatDate(
                            vendor.created_at
                          )}
                        />
                      </dl>

                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            handleEdit(vendor)
                          }
                          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
                        >
                          {isSelected
                            ? "Editando"
                            : "Editar"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
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
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function VendorDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>

      <dd className="max-w-[68%] break-words text-right font-medium text-slate-700">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}