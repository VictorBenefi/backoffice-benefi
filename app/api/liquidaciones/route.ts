import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/get-user-role";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const role = await getUserRole();

    const allowedRoles = [
      "admin",
      "supervisor",
      "operaciones",
    ];

    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tenés permisos para consultar las liquidaciones.",
        },
        { status: 403 }
      );
    }

    const [
      liquidationsResult,
      merchantsResult,
      branchesResult,
    ] = await Promise.all([
      supabase
        .from("menta_liquidation_summary")
        .select(`
        merchant_id_benefi,
        merchant_branch_id_benefi,
        merchant_payment_date,
        operation_count,
        pos_count,
        pos_codes,
        gross_amount,
        merchant_commission,
        merchant_commission_vat,
        financial_cost,
        financial_cost_vat,
        calculated_net_amount,
        merchant_net_amount,
        reconciliation_difference
        `)
        .order("merchant_payment_date", {
          ascending: false,
        }),

      supabase
        .from("merchants")
        .select("id, name")
        .order("name", {
          ascending: true,
        }),

      supabase
      .from("merchant_branches")
      .select(`
        id,
        merchant_id,
        branch_number,
        branch_name
      `)
      .order("branch_name", {
        ascending: true,
      }),
    ]);

    if (liquidationsResult.error) {
      throw new Error(
        `Liquidaciones: ${liquidationsResult.error.message}`
      );
    }

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

    return NextResponse.json({
      ok: true,

      liquidations:
        liquidationsResult.data || [],

      merchants:
        merchantsResult.data || [],

      branches:
        branchesResult.data || [],
    });
  } catch (error) {
    console.error(
      "Error cargando liquidaciones:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las liquidaciones.",
      },
      { status: 500 }
    );
  }
}