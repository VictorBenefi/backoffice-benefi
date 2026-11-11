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
  Math.abs(
    getTaxRate(
      transaction.tax_info,
      "CUSTOMER_TO_MERCHANT_COMMISSION"
    ) ?? 0
  );
  const acquirerRate =
  paymentMethod === "QR"
    ? Math.abs(
        Number(setting.acquirer_rate || 0)
      )
    : Math.abs(
        getTaxRate(
          transaction.tax_info,
          "ACQUIRER_TO_CUSTOMER_COMMISSION"
        ) ??
          Number(setting.acquirer_rate || 0)
      );

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

const LIQUIDATION_COLUMNS = `
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
`;

const TRANSACTION_COLUMNS = `
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
`;

async function getTransactionsByPeriod(
  dateFrom: string,
  dateTo: string
) {
  const transactions = [];
  const pageSize = 500;

  const current = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);

  while (current <= end) {
    const day = current.toISOString().slice(0, 10);
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("menta_transactions")
        .select(TRANSACTION_COLUMNS)
        .eq("status", "APPROVED")
        .eq("merchant_payment_date", day)
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(
          `Operaciones (${day}): ${error.message}`
        );
      }

      const rows = data || [];
      transactions.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return transactions;
}

async function getLiquidationsByPeriod(
  dateFrom: string,
  dateTo: string
) {
  const results: Array<
    Record<string, unknown>
  > = [];

  const current = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);

  while (current <= end) {
    const day = current.toISOString().slice(0, 10);

    let offset = 0;
    const pageSize = 500;

    while (true) {
      const { data, error } = await supabase
        .from("menta_liquidation_summary")
        .select(LIQUIDATION_COLUMNS)
        .gte("merchant_payment_date", day)
        .lte("merchant_payment_date", day)
        .order("merchant_payment_date", {
          ascending: false,
        })
        .order("merchant_id_benefi", {
          ascending: true,
        })
        .order("merchant_branch_id_benefi", {
          ascending: true,
          nullsFirst: true,
        })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(
          `Liquidaciones (${day}): ${error.message}`
        );
      }

      const rows = data || [];

      results.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return results;
}

export async function GET(request: Request) {
  try {

    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const validDate = (value: string | null) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }

      const date = new Date(`${value}T00:00:00Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (!validDate(dateFrom) || !validDate(dateTo)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Seleccioná un rango de fechas válido.",
        },
        { status: 400 }
      );
    }

    const from = dateFrom!;
    const to = dateTo!;

    const [fromYear, fromMonth] = from.split("-").map(Number);
    const [toYear, toMonth] = to.split("-").map(Number);

    const monthDifference =
      (toYear - fromYear) * 12 + (toMonth - fromMonth);

    if (from > to || monthDifference > 2) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El período de consulta no puede superar 3 meses calendario.",
        },
        { status: 400 }
      );
    }

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

    const inicioConsulta = performance.now();
    const [
      liquidationsResult,
      merchantsResult,
      branchesResult,
      paymentCostsResult,
      transactionsResult,
    ] = await Promise.all([
      getLiquidationsByPeriod(from, to),

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

      getTransactionsByPeriod(from, to),
    ]);
    console.log(
      "[Liquidaciones] Consultas Supabase:",
      Math.round(performance.now() - inicioConsulta),
      "ms"
    );

    const liquidationsData = liquidationsResult;

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

    
    const paymentCosts =
  paymentCostsResult.data || [];

const transactions = transactionsResult;


type EconomicsTotals = {
  merchantFee: number;
  acquirerCost: number;
  mentaCost: number;
  pandaCost: number;
  benefiProfit: number;
};

const transactionGroups = new Map<
  string,
  EconomicsTotals
>();

const getGroupKey = (
  merchantId: unknown,
  paymentDate: unknown,
  branchId: unknown
) =>
  JSON.stringify([
    merchantId ?? null,
    paymentDate ?? null,
    branchId || null,
  ]);

// Agrupamos y calculamos cada operación una sola vez.
for (const transaction of transactions) {
  const key = getGroupKey(
    transaction.merchant_id_benefi,
    transaction.merchant_payment_date,
    transaction.merchant_branch_id_benefi
  );

  let totals = transactionGroups.get(key);

  if (!totals) {
    totals = {
      merchantFee: 0,
      acquirerCost: 0,
      mentaCost: 0,
      pandaCost: 0,
      benefiProfit: 0,
    };

    transactionGroups.set(key, totals);
  }

  const economics = getTransactionEconomics(
    transaction,
    paymentCosts
  );

  totals.merchantFee += economics.merchantFee;
  totals.acquirerCost += economics.acquirerCost;
  totals.mentaCost += economics.mentaCost;
  totals.pandaCost += economics.pandaCost;
  totals.benefiProfit += economics.benefiProfit;
}

// Cada liquidación consulta únicamente su grupo.
const liquidationsWithEconomics =
  liquidationsData.map((liquidation) => {
    const key = getGroupKey(
      liquidation.merchant_id_benefi,
      liquidation.merchant_payment_date,
      liquidation.merchant_branch_id_benefi
    );

    const totals = transactionGroups.get(key);

    return {
      ...liquidation,

      benefi_economics: {
        merchant_fee: totals?.merchantFee ?? 0,
        acquirer_cost: totals?.acquirerCost ?? 0,
        menta_cost: totals?.mentaCost ?? 0,
        panda_cost: totals?.pandaCost ?? 0,
        benefi_profit: totals?.benefiProfit ?? 0,
      },
    };
  });


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