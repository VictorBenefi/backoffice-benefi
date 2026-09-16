import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/get-user-role";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getTaxRate(
  taxInfo: unknown,
  taxCode: string
) {
  if (
    !taxInfo ||
    typeof taxInfo !== "object" ||
    Array.isArray(taxInfo)
  ) {
    return null;
  }

  const taxData =
    taxInfo as Record<string, unknown>;

  const taxBreakdown = taxData.tax_breakdown;

  if (!Array.isArray(taxBreakdown)) {
    return null;
  }

  const item = taxBreakdown.find((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry)
    ) {
      return false;
    }

    const data =
      entry as Record<string, unknown>;

    return data.tax_code === taxCode;
  });

  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    return null;
  }

  const data = item as Record<string, unknown>;
  const rate = Number(data.rate);

  return Number.isFinite(rate) ? rate : null;
}

function getPaymentCostSetting(
  paymentMethod: string | null,
  transactionDate: string | null,
  paymentCosts: Array<{
    payment_method: string;
    acquirer_rate: number | string;
    menta_rate: number | string;
    panda_rate: number | string;
    valid_from: string;
    valid_to: string | null;
  }>
) {
  if (!paymentMethod || !transactionDate) {
    return null;
  }

  const method = paymentMethod
    .trim()
    .toUpperCase();

  const date = transactionDate.slice(0, 10);

  return (
    paymentCosts.find((setting) => {
      if (
        setting.payment_method
          .trim()
          .toUpperCase() !== method
      ) {
        return false;
      }

      if (date < setting.valid_from) {
        return false;
      }

      if (
        setting.valid_to &&
        date > setting.valid_to
      ) {
        return false;
      }

      return true;
    }) || null
  );
}

function getTransactionEconomics(
  transaction: {
    operation_type: string | null;
    payment_method: string | null;
    gross_amount: number | string | null;
    merchant_net_amount: number | string | null;
    transaction_datetime: string | null;
    tax_info: unknown;
  },
  paymentCosts: Array<{
    payment_method: string;
    acquirer_rate: number | string;
    menta_rate: number | string;
    panda_rate: number | string;
    valid_from: string;
    valid_to: string | null;
  }>
) {
  const operationType = (
    transaction.operation_type || ""
  )
    .trim()
    .toUpperCase();

  if (
    operationType.includes("CANCEL") ||
    operationType.includes("REFUND") ||
    operationType.includes("VOID")
  ) {
    return {
      merchantFee: 0,
      acquirerCost: 0,
      mentaCost: 0,
      pandaCost: 0,
      benefiProfit: 0,
    };
  }

  const setting = getPaymentCostSetting(
    transaction.payment_method,
    transaction.transaction_datetime,
    paymentCosts
  );

  if (!setting) {
    return {
      merchantFee: 0,
      acquirerCost: 0,
      mentaCost: 0,
      pandaCost: 0,
      benefiProfit: 0,
    };
  }

  const paymentMethod = (
    transaction.payment_method || ""
  )
    .trim()
    .toUpperCase();

  const grossAmount = Number(
    transaction.gross_amount || 0
  );

  const merchantNetAmount =
    transaction.merchant_net_amount == null
      ? null
      : Number(transaction.merchant_net_amount);

  const qrBonified =
    paymentMethod === "QR" &&
    merchantNetAmount !== null &&
    Math.abs(
      grossAmount - merchantNetAmount
    ) <= 0.01;

  if (qrBonified) {
    return {
      merchantFee: 0,
      acquirerCost: 0,
      mentaCost: 0,
      pandaCost: 0,
      benefiProfit: 0,
    };
  }

  const merchantRate =
    getTaxRate(
      transaction.tax_info,
      "CUSTOMER_TO_MERCHANT_COMMISSION"
    ) ?? 0;

  const acquirerRate =
    paymentMethod === "QR"
      ? Number(setting.acquirer_rate || 0)
      : getTaxRate(
          transaction.tax_info,
          "ACQUIRER_TO_CUSTOMER_COMMISSION"
        ) ??
        Number(setting.acquirer_rate || 0);

  const mentaRate = Number(
    setting.menta_rate || 0
  );

  const pandaRate = Number(
    setting.panda_rate || 0
  );

  const merchantFee =
    grossAmount * (merchantRate / 100);

  const acquirerCost =
    grossAmount * (acquirerRate / 100);

  const mentaCost =
    grossAmount * (mentaRate / 100);

  const pandaCost =
    grossAmount * (pandaRate / 100);

  const benefiProfit =
    merchantFee -
    acquirerCost -
    mentaCost -
    pandaCost;

  return {
    merchantFee,
    acquirerCost,
    mentaCost,
    pandaCost,
    benefiProfit,
  };
}

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
      paymentCostsResult,
      transactionsResult,
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

      supabase
      .from("menta_transactions")
      .select(`
        merchant_id_benefi,
        merchant_branch_id_benefi,
        merchant_payment_date,
        operation_type,
        payment_method,
        gross_amount,
        merchant_net_amount,
        transaction_datetime,
        status,
        tax_info
      `)
      .eq("status", "APPROVED")
      .not("merchant_payment_date", "is", null),
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

    if (paymentCostsResult.error) {
      throw new Error(
        `Costos de pagos: ${paymentCostsResult.error.message}`
      );
    }

    if (transactionsResult.error) {
      throw new Error(
        `Operaciones: ${transactionsResult.error.message}`
      );
    }

    const paymentCosts =
  paymentCostsResult.data || [];

const transactions =
  transactionsResult.data || [];

const liquidationsWithEconomics =
  (liquidationsResult.data || []).map(
    (liquidation) => {
      const liquidationTransactions =
        transactions.filter((transaction) => {
          if (
            transaction.merchant_id_benefi !==
            liquidation.merchant_id_benefi
          ) {
            return false;
          }

          if (
            transaction.merchant_payment_date !==
            liquidation.merchant_payment_date
          ) {
            return false;
          }

          const transactionBranch =
            transaction.merchant_branch_id_benefi ||
            null;

          const liquidationBranch =
            liquidation.merchant_branch_id_benefi ||
            null;

          return (
            transactionBranch ===
            liquidationBranch
          );
        });

      let merchantFee = 0;
      let acquirerCost = 0;
      let mentaCost = 0;
      let pandaCost = 0;
      let benefiProfit = 0;

      for (const transaction of liquidationTransactions) {
        const economics =
          getTransactionEconomics(
            transaction,
            paymentCosts
          );

        merchantFee += economics.merchantFee;
        acquirerCost += economics.acquirerCost;
        mentaCost += economics.mentaCost;
        pandaCost += economics.pandaCost;
        benefiProfit += economics.benefiProfit;
      }

      return {
        ...liquidation,

        benefi_economics: {
          merchant_fee: merchantFee,
          acquirer_cost: acquirerCost,
          menta_cost: mentaCost,
          panda_cost: pandaCost,
          benefi_profit: benefiProfit,
        },
      };
    }
  );

    return NextResponse.json({
      ok: true,

      liquidations: liquidationsWithEconomics,

      merchants:
        merchantsResult.data || [],

      branches:
        branchesResult.data || [],

      paymentCosts:
        paymentCostsResult.data || [],
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