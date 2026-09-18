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

function getTaxAmount(
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
  const amount = Number(data.amount);

  return Number.isFinite(amount)
    ? amount
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
    const branchId =
    searchParams.get("branch_id");

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
    
    if (branchId) {
      query = query.eq(
        "merchant_branch_id_benefi",
        branchId
      );
    } else {
      query = query.is(
        "merchant_branch_id_benefi",
        null
      );
    }

    let liquidationQuery = supabase
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
    );

  if (branchId) {
    liquidationQuery =
      liquidationQuery.eq(
        "merchant_branch_id_benefi",
        branchId
      );
  } else {
    liquidationQuery =
      liquidationQuery.is(
        "merchant_branch_id_benefi",
        null
      );
  }

    const [
      transactionsResult,
      merchantResult,
      branchesResult,
      posResult,
      liquidationResult,
      paymentCostsResult,
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

      branchId
      ? supabase
          .from("pos_devices")
          .select(
            "id, code, serial, merchant_reference, merchant_id, merchant_branch_id"
          )
          .eq(
            "merchant_id",
            merchantId
          )
          .eq(
            "merchant_branch_id",
            branchId
          )
          
      : supabase
          .from("pos_devices")
          .select(
            "id, code, serial, merchant_reference, merchant_id, merchant_branch_id"
          )
          .eq(
            "merchant_id",
            merchantId
          ),
      liquidationQuery.maybeSingle(),

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

    if (paymentCostsResult.error) {
      throw new Error(
        `Costos de pagos: ${paymentCostsResult.error.message}`
      );
    }

    const transactions =
      transactionsResult.data || [];

    const paymentCosts =
  paymentCostsResult.data || [];

const benefiEconomics =
  transactions.reduce(
    (totals, transaction) => {
      const economics =
        getTransactionEconomics(
          transaction,
          paymentCosts
        );

      totals.merchant_fee +=
        economics.merchantFee;

      totals.acquirer_cost +=
        economics.acquirerCost;

      totals.menta_cost +=
        economics.mentaCost;

      totals.panda_cost +=
        economics.pandaCost;

      totals.benefi_profit +=
        economics.benefiProfit;

      totals.menta_credit += economics.benefiMentaCredit;

      totals.expected_transfer +=
      economics.benefiExpectedTransfer;

      if (economics.benefiPayer === "PANDA") {
        totals.expected_transfer_panda +=
          economics.benefiExpectedTransfer;
      }

      if (economics.benefiPayer === "MENTA") {
        totals.expected_transfer_menta +=
          economics.benefiExpectedTransfer;
      }

      return totals;
    },
    {
      merchant_fee: 0,
      acquirer_cost: 0,
      menta_cost: 0,
      panda_cost: 0,
      benefi_profit: 0,
      expected_transfer: 0,
      expected_transfer_panda: 0,
      expected_transfer_menta: 0,
      menta_credit: 0,
    }
  );

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
    
    benefi_economics: {
      merchant_fee:
        benefiEconomics.merchant_fee,

      acquirer_cost:
        benefiEconomics.acquirer_cost,

      menta_cost:
        benefiEconomics.menta_cost,

      panda_cost:
        benefiEconomics.panda_cost,

      benefi_profit:
        benefiEconomics.benefi_profit,

      expected_transfer:
        benefiEconomics.expected_transfer,

      expected_transfer_panda:
        benefiEconomics.expected_transfer_panda,

      expected_transfer_menta:
        benefiEconomics.expected_transfer_menta,

      menta_credit:
        benefiEconomics.menta_credit,
    },
  },

  transactions: transactions.map(
    (transaction) => ({
      ...transaction,
      tax_info: transaction.tax_info,
    })
  ),

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