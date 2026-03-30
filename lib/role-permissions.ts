export const rolePermissions: Record<string, string[]> = {
  admin: [
    "/dashboard",
    "/vendedores",
    "/comercios",
    "/pos",
    "/movimientos",
    "/asignaciones",
  ],
  operaciones: [
    "/dashboard",
    "/vendedores",
    "/comercios",
    "/pos",
    "/movimientos",
    "/asignaciones",
  ],
  supervisor: [
    "/dashboard",
    "/vendedores",
    "/comercios",
    "/pos",
    "/movimientos",
  ],
  vendedor: [
    "/dashboard",
    "/comercios",
    "/pos",
    "/movimientos",
  ],
  soporte: [
    "/dashboard",
    "/pos",
    "/movimientos",
    "/asignaciones",
  ],
};

export function canAccess(role: string | null, path: string) {
  if (!role) return false;
  return rolePermissions[role]?.includes(path) || false;
}