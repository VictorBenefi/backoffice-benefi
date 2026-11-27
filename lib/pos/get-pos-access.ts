import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export class PosAccessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "PosAccessError";
  }
}

async function getTerminalAccess(
  request: Request,
  credential: string
) {
  const merchantId =
    request.headers.get("x-menta-merchant-id")?.trim();

  const serial =
    request.headers.get("x-pos-serial")?.trim();

  const invalidAccess = () =>
    new PosAccessError(
      "INVALID_POS_CREDENTIAL",
      "Terminal no autorizada.",
      401
    );

  if (
    !merchantId ||
    !serial ||
    !/^[0-9a-f]{64}$/.test(credential)
  ) {
    throw invalidAccess();
  }

  const credentialHash = createHash("sha256")
    .update(credential)
    .digest("hex");

  const { data: registered, error } =
    await supabase
      .from("pos_api_credentials")
      .select("id, pos_id, merchant_id, user_id")
      .eq("credential_hash", credentialHash)
      .eq("is_active", true)
      .is("revoked_at", null)
      .maybeSingle();

  if (error) {
    throw new Error(
      "No se pudo verificar la credencial POS."
    );
  }

  if (!registered) {
    throw invalidAccess();
  }

  const { data: device, error: deviceError } =
    await supabase
      .from("pos_devices")
      .select("id, merchant_id, serial, menta_terminal_id, status")
      .eq("id", registered.pos_id)
      .eq("merchant_id", registered.merchant_id)
      .eq("serial", serial)
      .in("status", [
        "assigned_merchant",
        "installed",
      ])
      .maybeSingle();

  if (deviceError) {
    throw new Error(
      "No se pudo verificar la terminal."
    );
  }

  if (!device || !device.menta_terminal_id) {
    throw invalidAccess();
  }

  const { data: assignments, error: assignmentError } =
    await supabase
      .from("pos_menta_merchant_assignments")
      .select("menta_merchant_id, valid_from, valid_to")
      .eq("pos_id", device.id)
      .eq("merchant_id", registered.merchant_id)
      .eq("menta_terminal_id", device.menta_terminal_id)
      .eq("verification_status", "verified");

  if (assignmentError) {
    throw new Error(
      "No se pudo verificar la asociacion MENTA."
    );
  }

  const now = Date.now();

  const activeAssignments = (assignments ?? []).filter(
    (assignment) =>
      assignment.valid_from !== null &&
      Date.parse(assignment.valid_from) <= now &&
      (
        assignment.valid_to === null ||
        Date.parse(assignment.valid_to) > now
      )
  );

  if (
    activeAssignments.length !== 1 ||
    activeAssignments[0].menta_merchant_id !== merchantId
  ) {
    throw invalidAccess();
  }

  const { data: appUser, error: userError } =
    await supabase
      .from("app_users")
      .select("id, name, role, is_active")
      .eq("id", registered.user_id)
      .eq("role", "pos_terminal")
      .eq("is_active", true)
      .is("auth_user_id", null)
      .maybeSingle();

  if (userError) {
    throw new Error(
      "No se pudo verificar la identidad POS."
    );
  }

  if (!appUser) {
    throw invalidAccess();
  }

  return {
    user: appUser,
    fullMerchantIds: [registered.merchant_id],
    allowedBranchIds: [] as string[],
    authenticatedPosId: device.id as string | null,
  };
}

export async function getPosAccess(request: Request) {
      if (
    process.env.NODE_ENV === "production" &&
    process.env.POS_SHIFT_CLOSURES_ENABLED !== "true"
  ) {
    throw new PosAccessError(
      "POS_SHIFT_CLOSURES_DISABLED",
      "El servicio de cierre de turno no está habilitado.",
      503
    );
  }

  // 1. Obtener token de autenticación.

  const authorization =
    request.headers.get("authorization") ?? "";

  const match =
    authorization.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    throw new PosAccessError(
      "UNAUTHORIZED",
      "Se requiere autenticación.",
      401
    );
  }

  const token = match[1];
    if (token.startsWith("pos_")) {
    return getTerminalAccess(
      request,
      token.slice(4)
    );
  }

  // 2. Validar usuario en Supabase Auth.

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    throw new PosAccessError(
      "INVALID_TOKEN",
      "La sesión no es válida o ha expirado.",
      401
    );
  }

  // 3. Recuperar usuario interno.

  const {
    data: appUser,
    error: appUserError,
  } = await supabase
    .from("app_users")
    .select("id, name, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (appUserError) {
    throw new Error(
      "No se pudo verificar el usuario interno."
    );
  }

  if (
    !appUser ||
    appUser.is_active !== true ||
    appUser.role !== "merchant"
  ) {
    throw new PosAccessError(
      "FORBIDDEN",
      "Usuario no autorizado para operar la POS.",
      403
    );
  }

  // 4. Recuperar permisos activos.

  const {
    data: accessRows,
    error: accessError,
  } = await supabase
    .from("merchant_user_access")
    .select(`
      merchant_group_id,
      merchant_brand_id,
      merchant_id,
      merchant_branch_id,
      role
    `)
    .eq("user_id", appUser.id)
    .eq("is_active", true);

  if (accessError) {
    throw new Error(
      "No se pudieron verificar los permisos."
    );
  }

  const access = accessRows ?? [];

  const fullMerchantIds = new Set<string>();
  const allowedBranchIds = new Set<string>();
  const groupIds = new Set<string>();
  const brandIds = new Set<string>();

  // 5. Resolver alcance de cada permiso.

  for (const item of access) {

    const scopes = [
      item.merchant_group_id,
      item.merchant_brand_id,
      item.merchant_id,
      item.merchant_branch_id,
    ].filter(Boolean);

    if (scopes.length !== 1) {
      throw new PosAccessError(
        "INVALID_ACCESS_SCOPE",
        "El usuario tiene permisos inconsistentes.",
        403
      );
    }

    if (
      item.merchant_group_id &&
      item.role === "group_admin"
    ) {
      groupIds.add(item.merchant_group_id);
    }

    if (
      item.merchant_brand_id &&
      item.role === "brand_admin"
    ) {
      brandIds.add(item.merchant_brand_id);
    }

    if (
      item.merchant_id &&
      item.role === "local_admin"
    ) {
      fullMerchantIds.add(item.merchant_id);
    }

    // Los permisos de sucursal se habilitarán
    // cuando se confirme su rol operativo.
  }

  // 6. Expandir permisos por grupo.

  if (groupIds.size > 0) {

    const { data, error } = await supabase
      .from("merchants")
      .select("id")
      .in(
        "merchant_group_id",
        Array.from(groupIds)
      );

    if (error) {
      throw new Error(
        "No se pudieron verificar los comercios del grupo."
      );
    }

    for (const merchant of data ?? []) {
      fullMerchantIds.add(merchant.id);
    }
  }

  // 7. Expandir permisos por marca.

  if (brandIds.size > 0) {

    const { data, error } = await supabase
      .from("merchants")
      .select("id")
      .in(
        "merchant_brand_id",
        Array.from(brandIds)
      );

    if (error) {
      throw new Error(
        "No se pudieron verificar los comercios de la marca."
      );
    }

    for (const merchant of data ?? []) {
      fullMerchantIds.add(merchant.id);
    }
  }

  if (
    fullMerchantIds.size === 0 &&
    allowedBranchIds.size === 0
  ) {
    throw new PosAccessError(
      "NO_MERCHANT_ACCESS",
      "El usuario no tiene permisos operativos habilitados.",
      403
    );
  }

  return {
    user: appUser,

    fullMerchantIds:
      Array.from(fullMerchantIds),

    allowedBranchIds:
      Array.from(allowedBranchIds),

    authenticatedPosId: null as string | null,
  };
}

export type PosAccess = Awaited<
  ReturnType<typeof getPosAccess>
>;

export async function getAuthorizedPosTerminals(
  access: PosAccess,
  merchantId: string
) {

  // 8. Verificar acceso al comercio.

  const fullAccess =
    access.fullMerchantIds.includes(merchantId);

  if (
    !fullAccess &&
    access.allowedBranchIds.length === 0
  ) {
    throw new PosAccessError(
      "MERCHANT_FORBIDDEN",
      "No tiene acceso al comercio solicitado.",
      403
    );
  }

  // 9. Recuperar terminales elegibles.

  let query = supabase
    .from("pos_devices")
    .select(`
      id,
      code,
      merchant_id,
      merchant_branch_id,
      menta_terminal_id,
      status
    `)
    .eq("merchant_id", merchantId)
    .in("status", [
      "assigned_merchant",
      "installed",
    ])
    .not("menta_terminal_id", "is", null);

  if (!fullAccess) {
    query = query.in(
      "merchant_branch_id",
      access.allowedBranchIds
    );
  }

  const { data: devices, error } =
    await query.order("code");

  if (error) {
    throw new Error(
      "No se pudieron consultar las terminales."
    );
  }

  if (!devices?.length) {
    return [];
  }

  // 10. Verificar asociaciones MENTA.

  const {
    data: assignments,
    error: assignmentError,
  } = await supabase
    .from("pos_menta_merchant_assignments")
    .select(`
      pos_id,
      merchant_id,
      menta_terminal_id,
      valid_from,
      valid_to
    `)
    .eq("merchant_id", merchantId)
    .eq("verification_status", "verified")
    .in(
      "pos_id",
      devices.map((device) => device.id)
    );

  if (assignmentError) {
    throw new Error(
      "No se pudieron verificar las asociaciones MENTA."
    );
  }

  const now = Date.now();

  return devices
    .filter((device) => {

      if (!device.menta_terminal_id?.trim()) {
        return false;
      }

return (assignments ?? []).some(
        (assignment) =>
          assignment.pos_id === device.id &&
          assignment.merchant_id === merchantId &&
          assignment.menta_terminal_id ===
            device.menta_terminal_id &&
          (
            (
              assignment.valid_from !== null &&
              Date.parse(assignment.valid_from) <= now &&
              (
                assignment.valid_to === null ||
                Date.parse(assignment.valid_to) > now
              )
            ) ||
            (
              process.env.NODE_ENV === "development" &&
              device.id ===
                "a931213d-f03b-454d-b46b-d2303d51bb83" &&
              merchantId ===
                "a1cfc732-64bc-4a7c-addb-95953499ea68" &&
              device.code === "Código interno: POS-TEST-MENTA" &&
              assignment.valid_from === null &&
              assignment.valid_to === null
            )
          )
      );
    })
    .map((device) => ({
      posId: device.id,
      code: device.code,
      merchantId: device.merchant_id,
      branchId: device.merchant_branch_id,
      terminalId: device.menta_terminal_id,
      status: device.status,
    }));
}