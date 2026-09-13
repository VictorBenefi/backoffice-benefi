import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/get-user-role";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
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
            "No tenés permisos para consultar el detalle de liquidaciones.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(
      request.url
    );

    const merchantId =
      searchParams.get("merchant_id");

    const paymentDate =
      searchParams.get("payment_date");

    if (
    !merchantId ||
    !paymentDate
    ) {
    return NextResponse.json(
        {
        ok: false,
        error:
            "Faltan parámetros para consultar la liquidación.",
        },
        { status: 400 }
    );
    }

    let query = supabase
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
        currency,
        transaction_datetime,
        merchant_payment_date,
        merchant_net_amount,
        status,
        installments,
        financing,
        acquirer,
        operation_detail
      `)
      .eq(
        "merchant_id_benefi",
        merchantId
      )
      .eq(
        "merchant_payment_date",
        paymentDate
      )
      .eq(
        "status",
        "APPROVED"
      );

    const [
      transactionsResult,
      merchantResult,
      branchesResult,
      posResult,
      liquidationResult,
    ] = await Promise.all([
      query.order(
        "transaction_datetime",
        {
          ascending: true,
        }
      ),

      supabase
      .from("merchants")
      .select(`
        id,
        name,
        cuit,
        address,
        street,
        street_number,
        floor,
        apartment,
        postal_code,
        city,
        province
      `)
      .eq("id", merchantId)
      .maybeSingle(),

      supabase
        .from("merchant_branches")
        .select(
          "id, merchant_id, branch_number, branch_name"
        )
        .eq(
          "merchant_id",
          merchantId
        ),

      supabase
        .from("pos_devices")
        .select(
          "id, code, serial, merchant_reference, merchant_id, merchant_branch_id"
        )
        .eq(
          "merchant_id",
          merchantId
        ),
      supabase
        .from("menta_liquidation_summary")
        .select(`
          merchant_commission,
          merchant_commission_vat,
          financial_cost,
          financial_cost_vat,
          calculated_net_amount,
          merchant_net_amount,
          reconciliation_difference
        `)
        .eq(
          "merchant_id_benefi",
          merchantId
        )
        .eq(
          "merchant_payment_date",
          paymentDate
        )
        .maybeSingle(),
    ]);

    if (transactionsResult.error) {
      throw new Error(
        `Operaciones: ${transactionsResult.error.message}`
      );
    }

    if (merchantResult.error) {
      throw new Error(
        `Comercio: ${merchantResult.error.message}`
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

    if (liquidationResult.error) {
      throw new Error(
        `Liquidación: ${liquidationResult.error.message}`
      );
    }

    const transactions =
      transactionsResult.data || [];

    const grossAmount =
      transactions.reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.gross_amount || 0
          ),
        0
      );

    const netAmount =
      transactions.reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.merchant_net_amount ||
              0
          ),
        0
      );

    const posIds = new Set(
      transactions
        .map(
          (transaction) =>
            transaction.pos_id
        )
        .filter(Boolean)
    );

  return NextResponse.json({
  ok: true,

  liquidation: {
    merchant_id: merchantId,

    merchant_name:
      merchantResult.data?.name ||
      "Sin vincular",

    merchant_cuit:
      merchantResult.data?.cuit ||
      null,

    merchant_address:
      merchantResult.data?.address ||
      null,

    merchant_street:
      merchantResult.data?.street ||
      null,

    merchant_street_number:
      merchantResult.data
        ?.street_number ||
      null,

    merchant_floor:
      merchantResult.data?.floor ||
      null,

    merchant_apartment:
      merchantResult.data
        ?.apartment ||
      null,

    merchant_postal_code:
      merchantResult.data
        ?.postal_code ||
      null,

    merchant_city:
      merchantResult.data?.city ||
      null,

    merchant_province:
      merchantResult.data
        ?.province ||
      null,

    payment_date: paymentDate,

    operation_count:
      transactions.length,

    pos_count:
      posIds.size,

    gross_amount:
      grossAmount,

    merchant_commission:
      Number(
        liquidationResult.data
          ?.merchant_commission || 0
      ),

    merchant_commission_vat:
      Number(
        liquidationResult.data
          ?.merchant_commission_vat || 0
      ),

    financial_cost:
      Number(
        liquidationResult.data
          ?.financial_cost || 0
      ),

    financial_cost_vat:
      Number(
        liquidationResult.data
          ?.financial_cost_vat || 0
      ),

    calculated_net_amount:
      Number(
        liquidationResult.data
          ?.calculated_net_amount || 0
      ),

    merchant_net_amount:
      netAmount,

    reconciliation_difference:
      Number(
        liquidationResult.data
          ?.reconciliation_difference ||
          0
      ),
  },

  transactions,

  branches:
    branchesResult.data || [],

  posDevices:
    posResult.data || [],
});
  } catch (error) {
    console.error(
      "Error cargando detalle de liquidación:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el detalle de la liquidación.",
      },
      { status: 500 }
    );
  }
}