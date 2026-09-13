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

    const now = new Date();

    const currentMonthStart = [
      now.getFullYear(),
      String(
        now.getMonth() + 1
      ).padStart(2, "0"),
      "01",
    ].join("-");

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
        liquidations: [],
        merchants: [],
        monthlySales: [],
      });
    }

    // =========================
    // LIQUIDACIONES
    // =========================

    let liquidationsQuery =
      supabase
        .from(
          "menta_liquidation_summary"
        )
        .select(`
          merchant_id_benefi,
          merchant_payment_date,
          operation_count,
          pos_count,
          pos_codes,
          gross_amount,
          merchant_net_amount,
          merchant_branch_id_benefi
        `);

    if (
      fullMerchantAccessIds.length > 0 &&
      allowedBranchIds.length > 0
    ) {
      liquidationsQuery =
        liquidationsQuery.or(
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
      liquidationsQuery =
        liquidationsQuery.in(
          "merchant_id_benefi",
          fullMerchantAccessIds
        );
    } else if (
      allowedBranchIds.length > 0
    ) {
      liquidationsQuery =
        liquidationsQuery.in(
          "merchant_branch_id_benefi",
          allowedBranchIds
        );
    }

    liquidationsQuery =
      liquidationsQuery.order(
        "merchant_payment_date",
        {
          ascending: false,
        }
      );

    // =========================
    // VENTAS DEL MES
    // =========================

    let monthlySalesQuery =
      supabase
        .from(
          "menta_monthly_sales_summary"
        )
        .select(`
          merchant_id_benefi,
          month_start,
          operation_count,
          gross_amount,
          merchant_branch_id_benefi
        `)
        .eq(
          "month_start",
          currentMonthStart
        );

    if (
      fullMerchantAccessIds.length > 0 &&
      allowedBranchIds.length > 0
    ) {
      monthlySalesQuery =
        monthlySalesQuery.or(
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
      monthlySalesQuery =
        monthlySalesQuery.in(
          "merchant_id_benefi",
          fullMerchantAccessIds
        );
    } else if (
      allowedBranchIds.length > 0
    ) {
      monthlySalesQuery =
        monthlySalesQuery.in(
          "merchant_branch_id_benefi",
          allowedBranchIds
        );
    }

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

    const [
      liquidationsResult,
      merchantsResult,
      monthlySalesResult,
    ] = await Promise.all([
      liquidationsQuery,
      merchantsQuery,
      monthlySalesQuery,
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

    if (monthlySalesResult.error) {
      throw new Error(
        `Ventas mensuales: ${monthlySalesResult.error.message}`
      );
    }

    // =========================
    // CONSOLIDAR LIQUIDACIONES
    // =========================

    const liquidationMap =
      new Map<
        string,
        {
          merchant_id_benefi: string;
          merchant_payment_date: string;
          operation_count: number;
          pos_count: number;
          pos_codes: string;
          gross_amount: number;
          merchant_net_amount: number;
        }
      >();

    for (
      const row of
        liquidationsResult.data ?? []
    ) {
      const key = [
        row.merchant_id_benefi,
        row.merchant_payment_date,
      ].join("|");

      const existing =
        liquidationMap.get(key);

      const rowPosCodes =
        String(
          row.pos_codes ?? ""
        )
          .split(",")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);

      if (!existing) {
        liquidationMap.set(
          key,
          {
            merchant_id_benefi:
              row.merchant_id_benefi,

            merchant_payment_date:
              row.merchant_payment_date,

            operation_count:
              Number(
                row.operation_count ?? 0
              ),

            pos_count:
              Number(
                row.pos_count ?? 0
              ),

            pos_codes:
              Array.from(
                new Set(rowPosCodes)
              ).join(", "),

            gross_amount:
              Number(
                row.gross_amount ?? 0
              ),

            merchant_net_amount:
              Number(
                row.merchant_net_amount ??
                  0
              ),
          }
        );

        continue;
      }

      existing.operation_count +=
        Number(
          row.operation_count ?? 0
        );

      existing.pos_count +=
        Number(
          row.pos_count ?? 0
        );

      existing.gross_amount +=
        Number(
          row.gross_amount ?? 0
        );

      existing.merchant_net_amount +=
        Number(
          row.merchant_net_amount ?? 0
        );

      const combinedCodes =
        new Set(
          [
            ...existing.pos_codes
              .split(",")
              .map((item) =>
                item.trim()
              )
              .filter(Boolean),

            ...rowPosCodes,
          ]
        );

      existing.pos_codes =
        Array.from(
          combinedCodes
        ).join(", ");
    }

    const liquidations =
      Array.from(
        liquidationMap.values()
      ).sort((a, b) =>
        b.merchant_payment_date.localeCompare(
          a.merchant_payment_date
        )
      );

    // =========================
    // CONSOLIDAR VENTAS MES
    // =========================

    const monthlySalesMap =
      new Map<
        string,
        {
          merchant_id_benefi: string;
          month_start: string;
          operation_count: number;
          gross_amount: number;
        }
      >();

    for (
      const row of
        monthlySalesResult.data ?? []
    ) {
      const key = [
        row.merchant_id_benefi,
        row.month_start,
      ].join("|");

      const existing =
        monthlySalesMap.get(key);

      if (!existing) {
        monthlySalesMap.set(
          key,
          {
            merchant_id_benefi:
              row.merchant_id_benefi,

            month_start:
              row.month_start,

            operation_count:
              Number(
                row.operation_count ?? 0
              ),

            gross_amount:
              Number(
                row.gross_amount ?? 0
              ),
          }
        );

        continue;
      }

      existing.operation_count +=
        Number(
          row.operation_count ?? 0
        );

      existing.gross_amount +=
        Number(
          row.gross_amount ?? 0
        );
    }

    const monthlySales =
      Array.from(
        monthlySalesMap.values()
      );

    return NextResponse.json({
      ok: true,

      liquidations,

      merchants:
        merchantsResult.data || [],

      monthlySales,
    });
  } catch (error) {
    console.error(
      "Error cargando dashboard comercio:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el Portal Comercio.",
      },
      { status: 500 }
    );
  }
}