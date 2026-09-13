import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/require-admin-api";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  try {
    const admin =
      await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        {
          error: "No autorizado.",
        },
        { status: 403 }
      );
    }

    const [
      merchantsResult,
      branchesResult,
      brandsResult,
      groupsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("merchants")
        .select("id, name")
        .order("name", {
          ascending: true,
        }),

      supabaseAdmin
        .from("merchant_branches")
        .select(`
          id,
          branch_name,
          merchant_id,
          merchants (
            id,
            name
          )
        `)
        .order("branch_name", {
          ascending: true,
        }),

      supabaseAdmin
        .from("merchant_brands")
        .select("id, name")
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        }),

      supabaseAdmin
        .from("merchant_groups")
        .select("id, name")
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        }),
    ]);

    if (merchantsResult.error) {
      throw new Error(
        `Comercios: ${merchantsResult.error.message}`
      );
    }

    if (branchesResult.error) {
      throw new Error(
        `Sucursales: ${branchesResult.error.message}`
      );
    }

    if (brandsResult.error) {
      throw new Error(
        `Marcas: ${brandsResult.error.message}`
      );
    }

    if (groupsResult.error) {
      throw new Error(
        `Grupos: ${groupsResult.error.message}`
      );
    }

    const branches =
      (branchesResult.data || []).map(
        (branch) => {
          const merchant = Array.isArray(
            branch.merchants
          )
            ? branch.merchants[0]
            : branch.merchants;

          return {
            id: branch.id,
            name:
              branch.branch_name ||
              "Sucursal sin nombre",
            merchant_id:
              branch.merchant_id,
            merchant_name:
              merchant?.name || "",
          };
        }
      );

    return NextResponse.json({
      ok: true,
      merchants:
        merchantsResult.data || [],
      branches,
      brands:
        brandsResult.data || [],
      groups:
        groupsResult.data || [],
    });
  } catch (error: unknown) {
    console.error(
      "ERROR MERCHANT ACCESS OPTIONS:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las opciones.",
      },
      { status: 500 }
    );
  }
}