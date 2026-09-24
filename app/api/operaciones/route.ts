import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/get-user-role";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAllTransactions(
  dateFrom: string | null,
  dateTo: string | null
) {
  const pageSize = 1000;
  let from = 0;
  let allTransactions: any[] = [];

  while (true) {
    const { data, error } = await supabase
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
        status,
        installments,
        financing,
        acquirer,
        merchant_net_amount,
        merchant_payment_date,
        operation_detail,
        tax_info
      `)
      .gte(
        "transaction_datetime",
        dateFrom
          ? `${dateFrom}T00:00:00-03:00`
          : "1970-01-01T00:00:00-03:00"
      )
      .lte(
        "transaction_datetime",
        dateTo
          ? `${dateTo}T23:59:59.999-03:00`
          : "2999-12-31T23:59:59.999-03:00"
      )
      .order("transaction_datetime", {
        ascending: false,
      })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Operaciones: ${error.message}`
      );
    }

    const rows = data || [];

    allTransactions =
      allTransactions.concat(rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allTransactions;
}

export async function GET(request: Request) {
  try {

    const { searchParams } = new URL(request.url);

    const dateFrom =
      searchParams.get("dateFrom");

    const dateTo =
      searchParams.get("dateTo");
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
            "No tenés permisos para consultar las operaciones.",
        },
        { status: 403 }
      );
    }

    const [
      transactionsResult,
      merchantsResult,
      branchesResult,
      posResult,
      paymentCostsResult,
    ] = await Promise.all([
        getAllTransactions(
          dateFrom,
          dateTo
        ),
      
      supabase
        .from("merchants")
        .select("id, name")
        .order("name", {
          ascending: true,
        }),

      supabase
        .from("merchant_branches")
        .select(
          "id, merchant_id, branch_number, branch_name"
        )
        .order("branch_number", {
          ascending: true,
        }),

      supabase
      .from("pos_devices")
      .select(
        "id, code, serial, merchant_reference, merchant_id, merchant_branch_id"
      )
      .order("code", {
        ascending: true,
      }),

    supabase
      .from("benefi_payment_cost_settings")
      .select(`
        id,
        payment_method,
        acquirer_rate,
        menta_rate,
        panda_rate,
        valid_from,
        valid_to,
        is_active
      `)
      .order("valid_from", {
        ascending: false,
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

    if (posResult.error) {
      throw new Error(
        `POS: ${posResult.error.message}`
      );
    }

    if (paymentCostsResult.error) {
      throw new Error(
        `Costos de pagos: ${paymentCostsResult.error.message}`
      );
    }

    return NextResponse.json({
      ok: true,

      transactions:
        transactionsResult,

      merchants:
        merchantsResult.data || [],

      branches:
        branchesResult.data || [],

      posDevices:
        posResult.data || [],

      paymentCosts:
        paymentCostsResult.data || [],
    });
  } catch (error) {
    console.error(
      "Error cargando operaciones:",
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