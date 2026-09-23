import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMerchantAccess } from "@/lib/get-merchant-access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const merchantAccess =
      await getMerchantAccess();

    if (!merchantAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tenés acceso al Portal Comercio.",
        },
        { status: 403 }
      );
    }

    const allowedMerchantIds =
      merchantAccess.allowedMerchantIds;

    const allowedBranchIds =
      merchantAccess.allowedBranchIds;

    const fullMerchantAccessIds =
      merchantAccess.fullMerchantAccessIds;

    if (
      allowedMerchantIds.length === 0 &&
      allowedBranchIds.length === 0
    ) {
      return NextResponse.json({
        ok: true,
        transactions: [],
        merchants: [],
        branches: [],
        posDevices: [],
      });
    }

    // =========================
    // OPERACIONES
    // =========================

    let transactionsQuery =
      supabase
        .from("menta_transactions")
        .select(`
          id,
          pos_id,
          merchant_id_benefi,
          merchant_branch_id_benefi,
          transaction_id,
          operation_id,
          operation_number,
          serial_number,
          operation_type,
          payment_method,
          gross_amount,
          merchant_net_amount,
          merchant_payment_date,
          currency,
          transaction_datetime,
          status,
          installments,
          financing,
          acquirer,
          operation_detail
        `);

    /*
     * Si tiene acceso completo a uno
     * o más comercios, puede ver todas
     * sus operaciones.
     *
     * Si además tiene accesos directos
     * a sucursales de otros comercios,
     * también se incorporan.
     */
    if (
      fullMerchantAccessIds.length > 0 &&
      allowedBranchIds.length > 0
    ) {
      transactionsQuery =
        transactionsQuery.or(
          [
            `merchant_id_benefi.in.(${fullMerchantAccessIds.join(
              ","
            )})`,
            `merchant_branch_id_benefi.in.(${allowedBranchIds.join(
              ","
            )})`,
          ].join(",")
        );
    } else if (
      fullMerchantAccessIds.length > 0
    ) {
      transactionsQuery =
        transactionsQuery.in(
          "merchant_id_benefi",
          fullMerchantAccessIds
        );
    } else if (
      allowedBranchIds.length > 0
    ) {
      /*
       * Usuario limitado a sucursal.
       *
       * NO filtramos por merchant_id,
       * porque eso le mostraría las
       * demás sucursales del comercio.
       */
      transactionsQuery =
        transactionsQuery.in(
          "merchant_branch_id_benefi",
          allowedBranchIds
        );
    } else {
      return NextResponse.json({
        ok: true,
        transactions: [],
        merchants: [],
        branches: [],
        posDevices: [],
      });
    }

    transactionsQuery =
      transactionsQuery.order(
        "transaction_datetime",
        {
          ascending: false,
        }
      );

    // =========================
    // COMERCIOS
    // =========================

    const merchantsQuery =
      supabase
        .from("merchants")
        .select("id, name")
        .in(
          "id",
          allowedMerchantIds
        )
        .order("name", {
          ascending: true,
        });

    // =========================
    // SUCURSALES
    // =========================

    const branchesQuery =
      supabase
        .from("merchant_branches")
        .select(
          "id, merchant_id, branch_number, branch_name"
        )
        .in(
          "id",
          allowedBranchIds
        )
        .order("branch_number", {
          ascending: true,
        });

    // =========================
    // POS
    // =========================

    let posQuery =
      supabase
        .from("pos_devices")
        .select(
          "id, code, serial, merchant_reference, merchant_id, merchant_branch_id"
        );

    if (
      fullMerchantAccessIds.length > 0 &&
      allowedBranchIds.length > 0
    ) {
      posQuery = posQuery.or(
        [
          `merchant_id.in.(${fullMerchantAccessIds.join(
            ","
          )})`,
          `merchant_branch_id.in.(${allowedBranchIds.join(
            ","
          )})`,
        ].join(",")
      );
    } else if (
      fullMerchantAccessIds.length > 0
    ) {
      posQuery = posQuery.in(
        "merchant_id",
        fullMerchantAccessIds
      );
    } else if (
      allowedBranchIds.length > 0
    ) {
      posQuery = posQuery.in(
        "merchant_branch_id",
        allowedBranchIds
      );
    }

    posQuery = posQuery.order(
      "code",
      {
        ascending: true,
      }
    );

    const [
      transactionsResult,
      merchantsResult,
      branchesResult,
      posResult,
    ] = await Promise.all([
      transactionsQuery,
      merchantsQuery,
      branchesQuery,
      posQuery,
    ]);

    if (transactionsResult.error) {
      throw new Error(
        `Operaciones: ${transactionsResult.error.message}`
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

    if (posResult.error) {
      throw new Error(
        `POS: ${posResult.error.message}`
      );
    }

    return NextResponse.json({
      ok: true,

      transactions:
        transactionsResult.data || [],

      merchants:
        merchantsResult.data || [],

      branches:
        branchesResult.data || [],

      posDevices:
        posResult.data || [],
    });
  } catch (error) {
    console.error(
      "Error cargando operaciones Portal Comercio:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las operaciones.",
      },
      { status: 500 }
    );
  }
}