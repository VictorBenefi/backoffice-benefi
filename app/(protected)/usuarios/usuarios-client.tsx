"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type AppUser = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "operaciones",
};

const roles = [
  "admin",
  "operaciones",
  "supervisor",
  "vendedor",
  "soporte",
];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 md:py-2.5";

export default function UsuariosClient() {
  const supabase = useMemo(() => createClient(), []);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(
    null
  );
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] =
    useState(initialForm);

  const [showPassword, setShowPassword] =
    useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showResetModal, setShowResetModal] =
    useState(false);

  const [resetUser, setResetUser] =
    useState<AppUser | null>(null);

  const [
    resetPasswordValue,
    setResetPasswordValue,
  ] = useState("");

  const [
    resetConfirmPassword,
    setResetConfirmPassword,
  ] = useState("");

  const [resetLoading, setResetLoading] =
    useState(false);

  const [
    showResetPassword,
    setShowResetPassword,
  ] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error(
        `Error cargando usuarios: ${error.message}`
      );

      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers((data as AppUser[]) || []);
    setLoading(false);
  }

  async function toggleActive(user: AppUser) {
    const nextValue = !user.is_active;

    setSavingId(user.id);

    const { error } = await supabase
      .from("app_users")
      .update({ is_active: nextValue })
      .eq("id", user.id);

    setSavingId(null);

    if (error) {
      toast.error(
        `Error actualizando estado: ${error.message}`
      );
      return;
    }

    toast.success(
      nextValue
        ? "Usuario activado correctamente."
        : "Usuario inactivado correctamente."
    );

    setUsers((previous) =>
      previous.map((item) =>
        item.id === user.id
          ? { ...item, is_active: nextValue }
          : item
      )
    );
  }

  function openResetModal(user: AppUser) {
    setResetUser(user);
    setResetPasswordValue("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
    setShowResetModal(true);
  }

  function closeResetModal(force = false) {
    if (resetLoading && !force) return;

    setShowResetModal(false);
    setResetUser(null);
    setResetPasswordValue("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
  }

  async function handleResetPassword() {
    if (!resetUser) {
      toast.error(
        "No se pudo identificar el usuario."
      );
      return;
    }

    if (!resetUser.auth_user_id) {
      toast.error(
        "Este usuario no tiene auth_user_id vinculado."
      );
      return;
    }

    if (
      !resetPasswordValue.trim() ||
      !resetConfirmPassword.trim()
    ) {
      toast.warning(
        "Debés completar ambos campos."
      );
      return;
    }

    if (resetPasswordValue.length < 6) {
      toast.warning(
        "La contraseña debe tener al menos 6 caracteres."
      );
      return;
    }

    if (
      resetPasswordValue !== resetConfirmPassword
    ) {
      toast.error(
        "Las contraseñas no coinciden."
      );
      return;
    }

    try {
      setResetLoading(true);

      const response = await fetch(
        "/api/admin/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: resetUser.auth_user_id,
            password: resetPasswordValue,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        toast.error(
          result?.error ||
            "No se pudo actualizar la contraseña."
        );
        return;
      }

      toast.success(
        result?.message ||
          "Contraseña actualizada correctamente."
      );

      setResetLoading(false);
      closeResetModal(true);
      await fetchUsers();
    } catch (error) {
      console.error(error);

      toast.error(
        "Error al actualizar contraseña."
      );
    } finally {
      setResetLoading(false);
    }
  }

  async function createUser(
    event: React.FormEvent
  ) {
    event.preventDefault();

    const name = formData.name.trim();
    const email = formData.email
      .trim()
      .toLowerCase();

    if (!name) {
      toast.warning(
        "Debés ingresar el nombre."
      );
      return;
    }

    if (!email) {
      toast.warning(
        "Debés ingresar el email."
      );
      return;
    }

    if (!formData.password.trim()) {
      toast.warning(
        "Debés ingresar la contraseña inicial."
      );
      return;
    }

    if (
      formData.password.trim().length < 6
    ) {
      toast.warning(
        "La contraseña inicial debe tener al menos 6 caracteres."
      );
      return;
    }

    const activeSameEmail = users.find(
      (user) =>
        (user.email || "")
          .trim()
          .toLowerCase() === email &&
        user.is_active
    );

    if (activeSameEmail) {
      toast.error(
        "Ya existe un usuario activo con ese correo. Inactivalo antes de crear otro."
      );
      return;
    }

    setCreating(true);

    try {
      const response = await fetch(
        "/api/admin/create-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password: formData.password,
            role: formData.role,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        toast.error(
          result?.error ||
            "No se pudo crear el usuario."
        );
        return;
      }

      toast.success(
        "Usuario creado correctamente."
      );

      setFormData(initialForm);
      setShowPassword(false);

      await fetchUsers();
    } catch (error) {
      console.error(error);

      toast.error(
        "Ocurrió un error al crear el usuario."
      );
    } finally {
      setCreating(false);
    }
  }

  const activeUsers = useMemo(
    () =>
      users.filter((user) => user.is_active)
        .length,
    [users]
  );

  const inactiveUsers = useMemo(
    () =>
      users.filter((user) => !user.is_active)
        .length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    const text = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !text ||
        (user.name || "")
          .toLowerCase()
          .includes(text) ||
        (user.email || "")
          .toLowerCase()
          .includes(text) ||
        (user.role || "")
          .toLowerCase()
          .includes(text);

      const matchesRole =
        roleFilter === "all" ||
        user.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          user.is_active) ||
        (statusFilter === "inactive" &&
          !user.is_active);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [
    users,
    search,
    roleFilter,
    statusFilter,
  ]);

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Cargando usuarios...
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 p-4 md:p-6">
        {/* ENCABEZADO */}
        <div className="mb-5 md:mb-6">
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
            Usuarios y roles
          </h1>

          <p className="mt-1 text-sm leading-6 text-slate-500 md:leading-normal">
            Administrá los accesos, roles y estados
            de los usuarios del BackOffice.
          </p>
        </div>

        {/* MÉTRICAS */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Usuarios totales"
            value={users.length}
          />

          <MetricCard
            label="Usuarios activos"
            value={activeUsers}
            variant="success"
          />

          <MetricCard
            label="Usuarios inactivos"
            value={inactiveUsers}
            variant="neutral"
          />
        </div>

        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          {/* FORMULARIO */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
              <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                Alta de usuario
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Creá una cuenta y asignale el rol
                correspondiente a su función.
              </p>
            </div>

            <form
              onSubmit={createUser}
              autoComplete="off"
            >
              <FormSection
                number="1"
                title="Datos personales"
                description="Ingresá la identificación y el correo de acceso."
              >
                <div className="space-y-4">
                  <Field label="Nombre">
                    <input
                      type="text"
                      className={inputClass}
                      value={formData.name}
                      onChange={(event) =>
                        setFormData(
                          (previous) => ({
                            ...previous,
                            name: event.target.value,
                          })
                        )
                      }
                      placeholder="Ej: Juan Pérez"
                      autoComplete="off"
                      disabled={creating}
                    />
                  </Field>

                  <Field label="Email / Usuario">
                    <input
                      type="email"
                      className={inputClass}
                      value={formData.email}
                      onChange={(event) =>
                        setFormData(
                          (previous) => ({
                            ...previous,
                            email: event.target.value,
                          })
                        )
                      }
                      placeholder="Ej: usuario@empresa.com"
                      autoComplete="new-email"
                      disabled={creating}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                number="2"
                title="Seguridad"
                description="Definí una contraseña inicial para el primer acceso."
                bordered
              >
                <Field label="Contraseña inicial">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      className={`${inputClass} min-w-0`}
                      value={formData.password}
                      onChange={(event) =>
                        setFormData(
                          (previous) => ({
                            ...previous,
                            password:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      disabled={creating}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (previous) => !previous
                        )
                      }
                      disabled={creating}
                      className="w-full whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {showPassword
                        ? "Ocultar"
                        : "Ver clave"}
                    </button>
                  </div>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    La contraseña debe tener al
                    menos 6 caracteres.
                  </p>
                </Field>
              </FormSection>

              <FormSection
                number="3"
                title="Permisos"
                description="Seleccioná el nivel de acceso que tendrá el usuario."
                bordered
              >
                <Field label="Rol">
                  <select
                    className={inputClass}
                    value={formData.role}
                    onChange={(event) =>
                      setFormData(
                        (previous) => ({
                          ...previous,
                          role: event.target.value,
                        })
                      )
                    }
                    disabled={creating}
                  >
                    {roles.map((role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-950">
                    Rol seleccionado:{" "}
                    {roleLabel(formData.role)}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-blue-700">
                    {roleDescription(
                      formData.role
                    )}
                  </p>
                </div>
              </FormSection>

              <div className="border-t border-slate-200 px-4 py-3 md:px-6 md:py-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {creating
                    ? "Creando usuario..."
                    : "Crear usuario"}
                </button>
              </div>
            </form>
          </section>

          {/* LISTADO */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
            <div className="border-b border-slate-200 px-4 py-4 md:px-6 md:py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 md:text-xl">
                    Usuarios existentes
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {filteredUsers.length} de{" "}
                    {users.length} usuarios
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  Total: {users.length}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <input
                  type="text"
                  className={inputClass}
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar por nombre, email o rol..."
                />

                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    className={inputClass}
                    value={roleFilter}
                    onChange={(event) =>
                      setRoleFilter(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      Todos los roles
                    </option>

                    {roles.map((role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {roleLabel(role)}
                      </option>
                    ))}
                  </select>

                  <select
                    className={inputClass}
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      Todos los estados
                    </option>

                    <option value="active">
                      Activos
                    </option>

                    <option value="inactive">
                      Inactivos
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="w-full whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-4">
              {filteredUsers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm text-slate-500">
                    {users.length === 0
                      ? "No hay usuarios registrados."
                      : "No se encontraron usuarios con los filtros seleccionados."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <UserCard
                      key={user.id}
                      user={user}
                      saving={
                        savingId === user.id
                      }
                      onToggle={() =>
                        toggleActive(user)
                      }
                      onReset={() =>
                        openResetModal(user)
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 md:px-6">
              <p className="text-xs leading-5 text-slate-500">
                El rol se define al crear el
                usuario. Si cambia de función, se
                recomienda inactivar la cuenta
                actual y crear una nueva con el rol
                correspondiente.
              </p>
            </div>
          </section>
        </div>
      </main>

      {showResetModal && resetUser && (
        <ResetPasswordModal
          user={resetUser}
          password={resetPasswordValue}
          confirmPassword={
            resetConfirmPassword
          }
          showPassword={showResetPassword}
          loading={resetLoading}
          onPasswordChange={
            setResetPasswordValue
          }
          onConfirmPasswordChange={
            setResetConfirmPassword
          }
          onTogglePassword={() =>
            setShowResetPassword(
              (previous) => !previous
            )
          }
          onCancel={() =>
            closeResetModal()
          }
          onConfirm={handleResetPassword}
        />
      )}
    </>
  );
}

function MetricCard({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "neutral";
}) {
  const styles = {
    default:
      "border-blue-200 bg-blue-50 text-blue-950",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-950",
    neutral:
      "border-slate-200 bg-white text-slate-950",
  };

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${styles[variant]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
    </div>
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

function UserCard({
  user,
  saving,
  onToggle,
  onReset,
}: {
  user: AppUser;
  saving: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-slate-950">
            {user.name || "Sin nombre"}
          </h3>

          <p className="mt-1 break-all text-sm text-slate-500">
            {user.email || "Sin email"}
          </p>
        </div>

        <StatusBadge active={Boolean(user.is_active)} />
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Rol asignado
        </p>

        <div className="mt-2">
          <RoleBadge role={user.role} />
        </div>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          {roleDescription(
            user.role || ""
          )}
        </p>
      </div>

      {!user.auth_user_id && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs leading-5 text-amber-700">
            Este usuario no tiene una cuenta de
            autenticación vinculada. No se podrá
            restablecer su contraseña.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
            user.is_active
              ? "border border-red-200 text-red-700 hover:bg-red-50"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {saving
            ? "Actualizando..."
            : user.is_active
              ? "Inactivar"
              : "Reactivar"}
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={!user.auth_user_id}
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Restablecer clave
        </button>
      </div>
    </article>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function RoleBadge({
  role,
}: {
  role: string | null;
}) {
  const roleStyles: Record<string, string> = {
    admin:
      "bg-violet-50 text-violet-700",
    operaciones:
      "bg-blue-50 text-blue-700",
    supervisor:
      "bg-amber-50 text-amber-700",
    vendedor:
      "bg-emerald-50 text-emerald-700",
    soporte:
      "bg-cyan-50 text-cyan-700",
  };

  const currentRole = role || "";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        roleStyles[currentRole] ||
        "bg-slate-100 text-slate-700"
      }`}
    >
      {roleLabel(currentRole)}
    </span>
  );
}

function ResetPasswordModal({
  user,
  password,
  confirmPassword,
  showPassword,
  loading,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onCancel,
  onConfirm,
}: {
  user: AppUser;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (
    value: string
  ) => void;
  onTogglePassword: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-950">
            Restablecer contraseña
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Definí una nueva contraseña para el
            usuario seleccionado.
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Usuario
            </p>

            <p className="mt-1 font-semibold text-slate-950">
              {user.name || "Sin nombre"}
            </p>

            <p className="mt-1 break-all text-sm text-slate-500">
              {user.email || "Sin email"}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Nueva contraseña">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                className={inputClass}
                value={password}
                onChange={(event) =>
                  onPasswordChange(
                    event.target.value
                  )
                }
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirmar contraseña">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                className={inputClass}
                value={confirmPassword}
                onChange={(event) =>
                  onConfirmPasswordChange(
                    event.target.value
                  )
                }
                placeholder="Repetí la nueva contraseña"
                disabled={loading}
                autoComplete="new-password"
              />
            </Field>

            {confirmPassword &&
              !passwordsMatch && (
                <p className="text-xs text-red-600">
                  Las contraseñas no coinciden.
                </p>
              )}

            {passwordsMatch && (
              <p className="text-xs text-emerald-600">
                Las contraseñas coinciden.
              </p>
            )}

            <button
              type="button"
              onClick={onTogglePassword}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showPassword
                ? "Ocultar contraseñas"
                : "Ver contraseñas"}
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loading
              ? "Actualizando..."
              : "Guardar nueva clave"}
          </button>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  switch (role) {
    case "admin":
      return "Administrador";
    case "operaciones":
      return "Operaciones";
    case "supervisor":
      return "Supervisor";
    case "vendedor":
      return "Vendedor";
    case "soporte":
      return "Soporte";
    default:
      return role || "Sin rol";
  }
}

function roleDescription(role: string) {
  switch (role) {
    case "admin":
      return "Acceso completo a la administración, configuración y gestión de usuarios.";
    case "operaciones":
      return "Acceso a la gestión operativa de comercios, equipos, asignaciones e instalaciones.";
    case "supervisor":
      return "Acceso a supervisión, seguimiento operativo, incidencias y comisiones.";
    case "vendedor":
      return "Acceso limitado a los comercios, equipos e instalaciones asignados.";
    case "soporte":
      return "Acceso a incidencias, soporte técnico y seguimiento de equipos.";
    default:
      return "No hay una descripción disponible para este rol.";
  }
}