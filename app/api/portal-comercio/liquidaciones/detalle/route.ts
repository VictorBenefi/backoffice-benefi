import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createClient } from "@supabase/supabase-js";
import { getMerchantAccess } from "@/lib/get-merchant-access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest
) {
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

    const { searchParams } = new URL(
      request.url
    );

    const merchantId =
      searchParams.get("merchant_id");

    const paymentDate =
      searchParams.get("payment_date");

    if (!merchantId || !paymentDate) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Faltan parámetros para consultar la liquidación.",
        },
        { status: 400 }
      );
    }

    const allowedMerchantIds =
      merchantAccess.allowedMerchantIds;

    const allowedBranchIds =
      merchantAccess.allowedBranchIds;

    const fullMerchantAccessIds =
      merchantAccess.fullMerchantAccessIds;

    if (
      !allowedMerchantIds.includes(
        merchantId
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tenés permisos para consultar este comercio.",
        },
        { status: 403 }
      );
    }

    const hasFullMerchantAccess =
      fullMerchantAccessIds.includes(
        merchantId
      );

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
          currency,
          transaction_datetime,
          merchant_payment_date,
          merchant_net_amount,
          status,
          installments,
          financing,
          acquirer,
          operation_detail,
          tax_info
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

    if (!hasFullMerchantAccess) {
      if (allowedBranchIds.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No tenés permisos para consultar esta liquidación.",
          },
          { status: 403 }
        );
      }

      transactionsQuery =
        transactionsQuery.in(
          "merchant_branch_id_benefi",
          allowedBranchIds
        );
    }

    transactionsQuery =
      transactionsQuery.order(
        "transaction_datetime",
        {
          ascending: true,
        }
      );

    // =========================
    // COMERCIO
    // =========================

    const merchantQuery =
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
        .maybeSingle();

    // =========================
    // POS
    // =========================

    let posQuery =
      supabase
        .from("pos_devices")
        .select(`
          id,
          code,
          serial,
          merchant_reference,
          merchant_id,
          merchant_branch_id
        `)
        .eq(
          "merchant_id",
          merchantId
        );

    if (!hasFullMerchantAccess) {
      posQuery =
        posQuery.in(
          "merchant_branch_id",
          allowedBranchIds
        );
    }

    // =========================
    // RESUMEN LIQUIDACIÓN
    // =========================

    let liquidationQuery =
      supabase
        .from(
          "menta_liquidation_summary"
        )
        .select(`
          merchant_id_benefi,
          merchant_branch_id_benefi,
          merchant_commission,
          merchant_commission_vat,
          financial_cost,
          financial_cost_vat,
          calculated_net_amount,
          merchant_net_amount
        `)
        .eq(
          "merchant_id_benefi",
          merchantId
        )
        .eq(
          "merchant_payment_date",
          paymentDate
        );

    if (!hasFullMerchantAccess) {
      liquidationQuery =
        liquidationQuery.in(
          "merchant_branch_id_benefi",
          allowedBranchIds
        );
    }

    const [
      transactionsResult,
      merchantResult,
      posResult,
      liquidationResult,
    ] = await Promise.all([
      transactionsQuery,
      merchantQuery,
      posQuery,
      liquidationQuery,
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

    const liquidationRows =
      liquidationResult.data || [];

    // =========================
// DESGLOSE FISCAL DINÁMICO
// =========================

type TaxBreakdownItem = {
  tax_code: string;
  label: string;
  amount: number;
};

function getTaxLabel(
  taxCode: string
) {
  const labels: Record<
    string,
    string
  > = {
    CUSTOMER_TO_MERCHANT_COMMISSION:
      "Comisión BENEFÍ",

    CUSTOMER_TO_MERCHANT_COMMISSION_VAT_TAX:
      "IVA sobre comisión BENEFÍ",

    FINANCIAL_COST:
      "Costo financiero",

    FINANCIAL_COST_VAT_TAX:
      "IVA sobre costo financiero",
  };

  if (labels[taxCode]) {
    return labels[taxCode];
  }

  const normalizedCode =
    taxCode.toUpperCase();

  if (
    normalizedCode.includes("IIBB") ||
    normalizedCode.includes(
      "GROSS_INCOME"
    )
  ) {
    return "Ingresos Brutos";
  }

  return taxCode
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

const taxBreakdownMap =
  new Map<string, number>();

for (const transaction of transactions) {
  const taxInfo =
    transaction.tax_info;

  const taxBreakdown =
    taxInfo &&
    typeof taxInfo === "object" &&
    Array.isArray(
      (
        taxInfo as {
          tax_breakdown?: unknown[];
        }
      ).tax_breakdown
    )
      ? (
          taxInfo as {
            tax_breakdown: Array<{
              tax_code?: string;
              amount?: number | string;
            }>;
          }
        ).tax_breakdown
      : [];

  for (const item of taxBreakdown) {
    const taxCode =
      String(
        item.tax_code || ""
      ).trim();

    if (!taxCode) {
      continue;
    }

    /*
     * Estos conceptos NO corresponden
     * a descuentos aplicados al comercio.
     */
    if (
      taxCode.startsWith(
        "ACQUIRER_TO_CUSTOMER_"
      ) ||
      taxCode ===
        "INSTALLMENT_AMOUNT"
    ) {
      continue;
    }

    const amount =
      Number(item.amount || 0);

    if (
      !Number.isFinite(amount)
    ) {
      continue;
    }

    taxBreakdownMap.set(
      taxCode,
      (
        taxBreakdownMap.get(
          taxCode
        ) || 0
      ) + amount
    );
  }
}

const taxBreakdown: TaxBreakdownItem[] =
  Array.from(
    taxBreakdownMap.entries()
  )
    .map(
      ([
        taxCode,
        amount,
      ]) => ({
        tax_code: taxCode,
        label:
          getTaxLabel(
            taxCode
          ),
        amount,
      })
    )
    .filter(
      (item) =>
        Math.abs(
          item.amount
        ) > 0.000001
    );

    // =========================
    // TOTALES OPERACIONES
    // =========================

    const grossAmount =
      transactions.reduce(
        (total, transaction) =>
          total +
          Number(
            transaction.gross_amount ||
              0
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

    // =========================
    // TOTALES LIQUIDACIÓN
    // =========================

    const merchantCommission =
      liquidationRows.reduce(
        (total, row) =>
          total +
          Number(
            row.merchant_commission ||
              0
          ),
        0
      );

    const merchantCommissionVat =
      liquidationRows.reduce(
        (total, row) =>
          total +
          Number(
            row.merchant_commission_vat ||
              0
          ),
        0
      );

    const financialCost =
      liquidationRows.reduce(
        (total, row) =>
          total +
          Number(
            row.financial_cost ||
              0
          ),
        0
      );

    const financialCostVat =
      liquidationRows.reduce(
        (total, row) =>
          total +
          Number(
            row.financial_cost_vat ||
              0
          ),
        0
      );

    const calculatedNetAmount =
      liquidationRows.reduce(
        (total, row) =>
          total +
          Number(
            row.calculated_net_amount ||
              0
          ),
        0
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
          merchantResult.data
            ?.address || null,

        merchant_street:
          merchantResult.data
            ?.street || null,

        merchant_street_number:
          merchantResult.data
            ?.street_number || null,

        merchant_floor:
          merchantResult.data
            ?.floor || null,

        merchant_apartment:
          merchantResult.data
            ?.apartment || null,

        merchant_postal_code:
          merchantResult.data
            ?.postal_code || null,

        merchant_city:
          merchantResult.data
            ?.city || null,

        merchant_province:
          merchantResult.data
            ?.province || null,

        payment_date:
          paymentDate,

        operation_count:
          transactions.length,

        pos_count:
          posIds.size,

        gross_amount:
          grossAmount,

        merchant_commission:
          merchantCommission,

        merchant_commission_vat:
          merchantCommissionVat,

        financial_cost:
          financialCost,

        financial_cost_vat:
          financialCostVat,

        calculated_net_amount:
          calculatedNetAmount,

        merchant_net_amount:
          netAmount,
      },

      transactions,

      taxBreakdown,

      posDevices:
        posResult.data || [],
    });
  } catch (error) {
    console.error(
      "Error cargando detalle Portal Comercio:",
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