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
        acquirer
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
    ] = await Promise.all([
      query.order(
        "transaction_datetime",
        {
          ascending: true,
        }
      ),

      supabase
        .from("merchants")
        .select("id, name")
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
          "id, code, serial, merchant_id, merchant_branch_id"
        )
        .eq(
          "merchant_id",
          merchantId
        ),
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

        payment_date: paymentDate,
        
        operation_count:
          transactions.length,

        pos_count:
          posIds.size,

        gross_amount:
          grossAmount,

        merchant_net_amount:
          netAmount,
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