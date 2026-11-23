
export type EconomicTransaction = {
  operation_type: string | null;
  payment_method: string | null;
  gross_amount: number | null;
  merchant_net_amount: number | null;
  transaction_datetime: string | null;
  status: string | null;
  tax_info: Record<string, unknown> | null;
};

export type PaymentCostSetting = {
  id: string;
  payment_method: "QR" | "DEBIT" | "CREDIT" | "PREPAID";
  acquirer_rate: number;
  menta_rate: number;
  panda_rate: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
};

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

export function isRefundOrCancellation(
  transaction: EconomicTransaction
) {
  const operationType = normalize(transaction.operation_type);
  const amount = Number(transaction.gross_amount || 0);

  return (
    amount < 0 ||
    operationType.includes("REFUND") ||
    operationType.includes("CANCEL") ||
    operationType.includes("VOID") ||
    operationType.includes("REVERS")
  );
}

function getTaxRate(
  taxInfo: Record<string, unknown> | null,
  taxType: string
) {
  if (!taxInfo) return null;

  const taxBreakdown = taxInfo.tax_breakdown;

  if (!Array.isArray(taxBreakdown)) return null;

  const item = taxBreakdown.find((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry)
    ) {
      return false;
    }

    const data = entry as Record<string, unknown>;
    return data.tax_code === taxType;
  });

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const data = item as Record<string, unknown>;
  const rate = Number(data.rate);

  return Number.isFinite(rate) ? rate : null;
}

function getMerchantRate(transaction: EconomicTransaction) {
  return getTaxRate(
    transaction.tax_info,
    "CUSTOMER_TO_MERCHANT_COMMISSION"
  );
}

function getAcquirerRate(transaction: EconomicTransaction) {
  return getTaxRate(
    transaction.tax_info,
    "ACQUIRER_TO_CUSTOMER_COMMISSION"
  );
}

function getPaymentCostSetting(
  transaction: EconomicTransaction,
  paymentCosts: PaymentCostSetting[]
) {
  const paymentMethod = normalize(transaction.payment_method);

  if (!transaction.transaction_datetime) return null;

  const transactionDate =
    transaction.transaction_datetime.slice(0, 10);

  return (
    paymentCosts.find((setting) => {
      if (normalize(setting.payment_method) !== paymentMethod) {
        return false;
      }

      if (transactionDate < setting.valid_from) {
        return false;
      }

      if (setting.valid_to && transactionDate > setting.valid_to) {
        return false;
      }

      return true;
    }) || null
  );
}

export function getOperationEconomics(
  transaction: EconomicTransaction,
  paymentCosts: PaymentCostSetting[]
) {
  const isApproved =
    normalize(transaction.status) === "APPROVED";

  if (!isApproved || isRefundOrCancellation(transaction)) {
    return {
      merchantRate: 0,
      acquirerRate: 0,
      mentaRate: 0,
      pandaRate: 0,
      merchantFee: 0,
      acquirerCost: 0,
      mentaCost: 0,
      pandaCost: 0,
      benefiProfit: 0,
    };
  }

  const setting = getPaymentCostSetting(transaction, paymentCosts);

  if (!setting) return null;

  const paymentMethod = normalize(transaction.payment_method);
  const grossAmount = Number(transaction.gross_amount || 0);
  const merchantNetAmount = Number(
    transaction.merchant_net_amount || 0
  );

  let merchantRate = 0;
  let acquirerRate = 0;
  let mentaRate = 0;
  let pandaRate = 0;

  const qrWithoutCommission =
    paymentMethod === "QR" &&
    Math.abs(grossAmount - merchantNetAmount) <= 0.01;

  if (!qrWithoutCommission) {
    merchantRate = getMerchantRate(transaction) ?? 0;

    acquirerRate =
      paymentMethod === "QR"
        ? Number(setting.acquirer_rate || 0)
        : getAcquirerRate(transaction) ??
          Number(setting.acquirer_rate || 0);

    mentaRate = Number(setting.menta_rate || 0);
    pandaRate = Number(setting.panda_rate || 0);
  }

  const merchantFee = grossAmount * (merchantRate / 100);
  const acquirerCost = grossAmount * (acquirerRate / 100);
  const mentaCost = grossAmount * (mentaRate / 100);
  const pandaCost = grossAmount * (pandaRate / 100);

  const benefiProfit =
    merchantFee - acquirerCost - mentaCost - pandaCost;

  return {
    merchantRate,
    acquirerRate,
    mentaRate,
    pandaRate,
    merchantFee,
    acquirerCost,
    mentaCost,
    pandaCost,
    benefiProfit,
  };
}
