import { NextRequest, NextResponse } from "next/server";
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

  return Number.isFinite(rate)
    ? rate
    : null;
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
    benefiExpectedTransfer: 0,
    benefiPayer: null,
    benefiMentaCredit: 0,
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
      benefiExpectedTransfer: 0,
      benefiPayer: null,
      benefiMentaCredit: 0,
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

  const benefiMentaCredit =
  paymentMethod === "QR"
    ? benefiProfit
    : 0;

  const customerNetAmount =
  transaction.tax_info &&
  typeof transaction.tax_info === "object" &&
  !Array.isArray(transaction.tax_info)
    ? Number(
        (
          transaction.tax_info as Record<
            string,
            unknown
          >
        ).customer_net_amount
      )
    : 0;

    

    const benefiExpectedTransfer =
    paymentMethod === "CREDIT" ||
    paymentMethod === "DEBIT"
        ? merchantFee -
        acquirerCost -
        pandaCost
        : 0;

    const benefiPayer =
    paymentMethod === "CREDIT" ||
    paymentMethod === "DEBIT"
        ? "PANDA"
        : paymentMethod === "QR"
        ? "MENTA"
        : null;

  return {
    merchantFee,
    acquirerCost,
    mentaCost,
    pandaCost,
    benefiProfit,
    benefiExpectedTransfer,
    benefiPayer,
    benefiMentaCredit,
  };
}
export async function GET(request: NextRequest) {
  const role = await getUserRole();

  if (role !== "admin") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }
  const { searchParams } = new URL(request.url);

  const month = searchParams.get("month");

  if (
    !month ||
    !/^\d{4}-\d{2}$/.test(month)
  ) {
    return NextResponse.json(
      {
        error:
          "El período debe tener formato YYYY-MM",
      },
      { status: 400 }
    );
  }

  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  const startDate =
    `${year}-${String(monthNumber).padStart(2, "0")}-01`;

  const nextMonth =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(
          monthNumber + 1
        ).padStart(2, "0")}-01`;

        const paymentCostsResult = await supabase
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
    });

    if (paymentCostsResult.error) {
    console.error(
        "Error loading BENEFÍ payment costs:",
        paymentCostsResult.error
    );

    return NextResponse.json(
        {
        error:
            "No se pudo cargar la configuración de costos BENEFÍ",
        },
        { status: 500 }
    );
    }

    const transactionsResult = await supabase
    .from("menta_transactions")
    .select(`
        id,
        merchant_id_benefi,
        merchant_branch_id_benefi,
        merchant_payment_date,
        operation_number,
        operation_type,
        payment_method,
        installments,
        gross_amount,
        merchant_net_amount,
        transaction_datetime,
        status,
        pos_id,
        operation_detail,
        tax_info
    `)
    .eq("status", "APPROVED")
    .gte("merchant_payment_date", startDate)
    .lt("merchant_payment_date", nextMonth)
    .order("merchant_payment_date", {
        ascending: true,
    });

  if (transactionsResult.error) {
  console.error(
    "Error loading BENEFÍ report transactions:",
    transactionsResult.error
  );

  return NextResponse.json(
    {
      error:
        "No se pudieron cargar las operaciones del informe",
    },
    { status: 500 }
  );
}

const paymentCosts =
  paymentCostsResult.data || [];

const transactions =
  transactionsResult.data || [];

const totals = transactions.reduce(
  (acc, transaction) => {
    const economics =
      getTransactionEconomics(
        transaction,
        paymentCosts
      );

    acc.operation_count += 1;

    acc.gross_amount += Number(
      transaction.gross_amount || 0
    );

    acc.merchant_net_amount += Number(
      transaction.merchant_net_amount || 0
    );

    acc.merchant_fee +=
      economics.merchantFee;

    acc.acquirer_cost +=
      economics.acquirerCost;

    acc.menta_cost +=
      economics.mentaCost;

    acc.panda_cost +=
      economics.pandaCost;

    acc.benefi_profit +=
      economics.benefiProfit;

    acc.expected_transfer_panda +=
      economics.benefiPayer === "PANDA"
        ? economics.benefiExpectedTransfer
        : 0;

    acc.menta_credit +=
      economics.benefiMentaCredit;

    return acc;
  },
  {
    operation_count: 0,
    gross_amount: 0,
    merchant_net_amount: 0,
    merchant_fee: 0,
    acquirer_cost: 0,
    menta_cost: 0,
    panda_cost: 0,
    benefi_profit: 0,
    expected_transfer_panda: 0,
    menta_credit: 0,
  }
);

const merchantsResult = await supabase
  .from("merchants")
  .select(`
    id,
    name
  `);

if (merchantsResult.error) {
  console.error(
    "Error loading BENEFÍ report merchants:",
    merchantsResult.error
  );

  return NextResponse.json(
    {
      error:
        "No se pudieron cargar los comercios del informe",
    },
    { status: 500 }
  );
}

const merchantMap = new Map(
  (merchantsResult.data || []).map(
    (merchant) => [
      merchant.id,
      merchant.name,
    ]
  )
);

const operationDetails = transactions.map(
  (transaction) => {
    const economics =
      getTransactionEconomics(
        transaction,
        paymentCosts
      );

    return {
      id: transaction.id,
      merchant_id:
        transaction.merchant_id_benefi,

    merchant_name:
        merchantMap.get(
            transaction.merchant_id_benefi
        ) || "Sin comercio",
            branch_id:
        transaction.merchant_branch_id_benefi,
      payment_date:
        transaction.merchant_payment_date,
      transaction_datetime:
        transaction.transaction_datetime,
      operation_number:
        transaction.operation_number,
      payment_method:
        transaction.payment_method,
      installments:
        transaction.installments,
      pos_id:
        transaction.pos_id,
      operation_detail:
        transaction.operation_detail,
      gross_amount: Number(
        transaction.gross_amount || 0
      ),
      merchant_net_amount: Number(
        transaction.merchant_net_amount || 0
      ),
      merchant_fee:
        economics.merchantFee,
      acquirer_cost:
        economics.acquirerCost,
      menta_cost:
        economics.mentaCost,
      panda_cost:
        economics.pandaCost,
      benefi_profit:
        economics.benefiProfit,
      expected_transfer_panda:
        economics.benefiPayer === "PANDA"
          ? economics.benefiExpectedTransfer
          : 0,
      menta_credit:
        economics.benefiMentaCredit,
    };
  }
);

const liquidationMap = new Map<
  string,
  {
    payment_date: string;
    merchant_id: string;
    merchant_name: string;
    operation_count: number;
    gross_amount: number;
    merchant_net_amount: number;
    merchant_fee: number;
    acquirer_cost: number;
    menta_cost: number;
    panda_cost: number;
    benefi_profit: number;
    expected_transfer_panda: number;
    menta_credit: number;
  }
>();

for (const operation of operationDetails) {
  const key =
    `${operation.merchant_id}|${operation.payment_date}`;

  const current =
    liquidationMap.get(key) || {
      payment_date:
        operation.payment_date || "",
      merchant_id:
        operation.merchant_id || "",
      merchant_name:
        operation.merchant_name,
      operation_count: 0,
      gross_amount: 0,
      merchant_net_amount: 0,
      merchant_fee: 0,
      acquirer_cost: 0,
      menta_cost: 0,
      panda_cost: 0,
      benefi_profit: 0,
      expected_transfer_panda: 0,
      menta_credit: 0,
    };

  current.operation_count += 1;
  current.gross_amount +=
    operation.gross_amount;
  current.merchant_net_amount +=
    operation.merchant_net_amount;
  current.merchant_fee +=
    operation.merchant_fee;
  current.acquirer_cost +=
    operation.acquirer_cost;
  current.menta_cost +=
    operation.menta_cost;
  current.panda_cost +=
    operation.panda_cost;
  current.benefi_profit +=
    operation.benefi_profit;
  current.expected_transfer_panda +=
    operation.expected_transfer_panda;
  current.menta_credit +=
    operation.menta_credit;

  liquidationMap.set(key, current);
}

const liquidationDetails = Array.from(
  liquidationMap.values()
).sort((a, b) =>
  a.payment_date.localeCompare(
    b.payment_date
  )
);

return NextResponse.json({
  ok: true,
  month,
  startDate,
  nextMonth,
  transactionCount:
    transactionsResult.data?.length || 0,
  totals,
  operations: operationDetails,
  liquidations: liquidationDetails,
});
}