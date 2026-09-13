import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function getMerchantAccess() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const normalizedEmail = user.email
    .trim()
    .toLowerCase();

  const {
    data: appUsers,
    error: appUserError,
  } = await supabase
    .from("app_users")
    .select(
      "id, name, email, role, is_active"
    )
    .eq("email", normalizedEmail)
    .limit(1);

  if (appUserError) {
    console.log(
      "Error obteniendo usuario comercio:",
      appUserError
    );

    return null;
  }

  const appUser = appUsers?.[0];

  if (
    !appUser ||
    appUser.is_active === false ||
    appUser.role !== "merchant"
  ) {
    return null;
  }

  const {
    data: accessRows,
    error: accessError,
  } = await supabase
    .from("merchant_user_access")
    .select(
      `
      id,
      merchant_group_id,
      merchant_brand_id,
      merchant_id,
      merchant_branch_id,
      role,
      is_active
      `
    )
    .eq("user_id", appUser.id)
    .eq("is_active", true);

  if (accessError) {
    console.log(
      "Error obteniendo accesos del comercio:",
      accessError
    );

    return null;
  }

  const access = accessRows ?? [];

  /*
   * Comercios a los que el usuario
   * pertenece de alguna manera.
   *
   * Sirve para consultar datos generales
   * del comercio padre.
   */
  const allowedMerchantIds =
    new Set<string>();

  /*
   * Comercios cuyo alcance es COMPLETO.
   *
   * Si un comercio entra acá,
   * el usuario puede acceder a todas
   * sus sucursales.
   */
  const fullMerchantAccessIds =
    new Set<string>();

  /*
   * Sucursales permitidas.
   */
  const allowedBranchIds =
    new Set<string>();

  // =========================
  // ACCESO DIRECTO A SUCURSAL
  // =========================

  const directBranchIds = access
    .map(
      (item) =>
        item.merchant_branch_id
    )
    .filter(
      (
        id
      ): id is string =>
        Boolean(id)
    );

  if (directBranchIds.length > 0) {
    const {
      data: directBranches,
      error: directBranchesError,
    } = await supabaseAdmin
      .from("merchant_branches")
      .select("id, merchant_id")
      .in(
        "id",
        directBranchIds
      );

    if (directBranchesError) {
      console.log(
        "Error obteniendo sucursales permitidas:",
        directBranchesError
      );

      return null;
    }

    (
      directBranches ?? []
    ).forEach((branch) => {
      allowedBranchIds.add(
        branch.id
      );

      /*
       * Agregamos el comercio padre
       * para poder consultar sus datos,
       * pero NO lo agregamos como
       * acceso completo.
       */
      allowedMerchantIds.add(
        branch.merchant_id
      );
    });
  }

  // =========================
  // ACCESO DIRECTO A COMERCIO
  // =========================

  access.forEach((item) => {
    if (item.merchant_id) {
      allowedMerchantIds.add(
        item.merchant_id
      );

      fullMerchantAccessIds.add(
        item.merchant_id
      );
    }
  });

  // =========================
  // ACCESO POR MARCA
  // =========================

  const brandIds = access
    .map(
      (item) =>
        item.merchant_brand_id
    )
    .filter(
      (
        id
      ): id is string =>
        Boolean(id)
    );

  if (brandIds.length > 0) {
    const {
      data: brandMerchants,
      error: brandMerchantsError,
    } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .in(
        "merchant_brand_id",
        brandIds
      );

    if (brandMerchantsError) {
      console.log(
        "Error obteniendo comercios por marca:",
        brandMerchantsError
      );

      return null;
    }

    (
      brandMerchants ?? []
    ).forEach((merchant) => {
      allowedMerchantIds.add(
        merchant.id
      );

      fullMerchantAccessIds.add(
        merchant.id
      );
    });
  }

  // =========================
  // ACCESO POR GRUPO
  // =========================

  const groupIds = access
    .map(
      (item) =>
        item.merchant_group_id
    )
    .filter(
      (
        id
      ): id is string =>
        Boolean(id)
    );

  if (groupIds.length > 0) {
    const {
      data: groupMerchants,
      error: groupMerchantsError,
    } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .in(
        "merchant_group_id",
        groupIds
      );

    if (groupMerchantsError) {
      console.log(
        "Error obteniendo comercios por grupo:",
        groupMerchantsError
      );

      return null;
    }

    (
      groupMerchants ?? []
    ).forEach((merchant) => {
      allowedMerchantIds.add(
        merchant.id
      );

      fullMerchantAccessIds.add(
        merchant.id
      );
    });
  }

  // =========================
  // EXPANDIR SUCURSALES
  // =========================

  const fullMerchantIds =
    Array.from(
      fullMerchantAccessIds
    );

  if (fullMerchantIds.length > 0) {
    const {
      data: merchantBranches,
      error: merchantBranchesError,
    } = await supabaseAdmin
      .from("merchant_branches")
      .select("id, merchant_id")
      .in(
        "merchant_id",
        fullMerchantIds
      );

    if (merchantBranchesError) {
      console.log(
        "Error obteniendo sucursales de comercios:",
        merchantBranchesError
      );

      return null;
    }

    (
      merchantBranches ?? []
    ).forEach((branch) => {
      allowedBranchIds.add(
        branch.id
      );
    });
  }

  // =========================
  // RESULTADO FINAL
  // =========================

  return {
    user: appUser,
    access,

    allowedMerchantIds:
      Array.from(
        allowedMerchantIds
      ),

    fullMerchantAccessIds:
      Array.from(
        fullMerchantAccessIds
      ),

    allowedBranchIds:
      Array.from(
        allowedBranchIds
      ),
  };
}