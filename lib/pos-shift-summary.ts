
import "server-only";

import type {
  MentaShiftTransaction,
} from "@/lib/menta/shift-transactions";

export type ShiftTerminal = {
  posId: string;
  code: string;
  terminalId: string;
};

type AmountTotals = {
  operationCount: number;
  approvedCount: number;
  paymentCount: number;
  annulmentCount: number;
  refundCount: number;
  rejectedCount: number;
  failedCount: number;
  otherStatusCount: number;
  paymentCents: number;
  annulmentCents: number;
  refundCents: number;
};

function createTotals(): AmountTotals {
  return {
    operationCount: 0,
    approvedCount: 0,
    paymentCount: 0,
    annulmentCount: 0,
    refundCount: 0,
    rejectedCount: 0,
    failedCount: 0,
    otherStatusCount: 0,
    paymentCents: 0,
    annulmentCents: 0,
    refundCents: 0,
  };
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function amountInCents(value: unknown): number {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    throw new Error("Importe no informado.");
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error("Importe inválido.");
  }

  const cents = Math.round(amount * 100);

  if (!Number.isSafeInteger(cents)) {
    throw new Error("Importe fuera del rango permitido.");
  }

  return cents;
}

function getCategory(
  transaction: MentaShiftTransaction
) {
  const method =
    normalize(transaction.payment_method) ||
    "UNKNOWN";

  let brand =
    method === "QR"
      ? ""
      : normalize(
          transaction.operation_detail?.card?.card_brand
        ) || "SIN MARCA";

  if (brand === "MASTER") {
    brand = "MASTERCARD";
  }

  const international =
    method !== "QR" &&
    transaction.operation_detail?.card
      ?.is_international_card === true;

  const methodLabels: Record<string, string> = {
    QR: "QR",
    DEBIT: "DÉBITO",
    CREDIT: "CRÉDITO",
    PREPAID: "PREPAGA",
    UNKNOWN: "SIN MEDIO INFORMADO",
  };

  const methodLabel =
    methodLabels[method] || method;

  const label = [
    methodLabel,
    brand,
    international ? "INTERNACIONAL" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    key: JSON.stringify([
      method,
      brand,
      international,
    ]),
    method,
    brand: brand || null,
    international,
    label,
  };
}

type ShiftCategory = ReturnType<typeof getCategory>;

function accumulate(
  totals: AmountTotals,
  transaction: MentaShiftTransaction
) {
  totals.operationCount++;

  const status = normalize(transaction.status);
  const type = normalize(transaction.operation_type);

  if (status === "REJECTED") {
    totals.rejectedCount++;
    return;
  }

  if (status === "FAILED") {
    totals.failedCount++;
    return;
  }

  if (status !== "APPROVED") {
    totals.otherStatusCount++;
    return;
  }

  if (normalize(transaction.currency) !== "ARS") {
    throw new Error(
      "Se encontró una operación en una moneda no contemplada."
    );
  }

  const cents = amountInCents(
    transaction.gross_amount
  );

  totals.approvedCount++;

  switch (type) {
    case "PAYMENT":
      if (cents < 0) {
        throw new Error(
          "Se encontró una venta con importe negativo."
        );
      }

      totals.paymentCount++;
      totals.paymentCents += cents;
      break;

    case "ANNULMENT":
      totals.annulmentCount++;
      totals.annulmentCents += Math.abs(cents);
      break;

    case "REFUND":
      totals.refundCount++;
      totals.refundCents += Math.abs(cents);
      break;

    default:
      throw new Error(
        `Tipo de operación no contemplado: ${type}`
      );
  }
}

function formatTotals(totals: AmountTotals) {
  const {
    paymentCents,
    annulmentCents,
    refundCents,
    ...counts
  } = totals;

  const netCents =
    paymentCents -
    annulmentCents -
    refundCents;

  if (
    ![
      paymentCents,
      annulmentCents,
      refundCents,
      netCents,
    ].every(Number.isSafeInteger)
  ) {
    throw new Error(
      "Los totales exceden el rango permitido."
    );
  }

  return {
    ...counts,
    paymentAmount: paymentCents / 100,
    annulmentAmount: annulmentCents / 100,
    refundAmount: refundCents / 100,
    netAmount: netCents / 100,
  };
}

function summarizeTransactions(
  transactions: MentaShiftTransaction[]
) {
  const totals = createTotals();

  const categories = new Map<
    string,
    {
      category: ShiftCategory;
      totals: AmountTotals;
    }
  >();

  for (const transaction of transactions) {
    accumulate(totals, transaction);

    const category = getCategory(transaction);

    let item = categories.get(category.key);

    if (!item) {
      item = {
        category,
        totals: createTotals(),
      };

      categories.set(category.key, item);
    }

    accumulate(item.totals, transaction);
  }

  return {
    ...formatTotals(totals),

    categories: Array.from(categories.values())
      .map((item) => ({
        ...item.category,
        ...formatTotals(item.totals),
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es")
      ),
  };
}

export function buildPosShiftSummary(
  terminals: ShiftTerminal[],
  transactions: MentaShiftTransaction[]
) {
  if (terminals.length === 0) {
    throw new Error(
      "No se seleccionaron terminales."
    );
  }

  const terminalIds = new Set<string>();
  const posIds = new Set<string>();

  for (const terminal of terminals) {
    if (
      !terminal.terminalId.trim() ||
      !terminal.posId.trim() ||
      terminalIds.has(terminal.terminalId) ||
      posIds.has(terminal.posId)
    ) {
      throw new Error(
        "Terminales inválidas o duplicadas."
      );
    }

    terminalIds.add(terminal.terminalId);
    posIds.add(terminal.posId);
  }

  const operationIds = new Set<string>();

  for (const transaction of transactions) {
    const terminalId = String(
      transaction.terminal_id ?? ""
    ).trim();

    const operationId = String(
      transaction.operation_id ?? ""
    ).trim();

    if (!terminalIds.has(terminalId)) {
      throw new Error(
        "Se encontró una operación de una terminal no seleccionada."
      );
    }

    if (
      !operationId ||
      operationIds.has(operationId)
    ) {
      throw new Error(
        "Se encontró una operación inválida o duplicada."
      );
    }

    operationIds.add(operationId);
  }

  const terminalSummary = terminals.map(
    (terminal) => {
      const operations = transactions.filter(
        (transaction) =>
          String(
            transaction.terminal_id ?? ""
          ).trim() === terminal.terminalId
      );

      return {
        posId: terminal.posId,
        code: terminal.code,
        terminalId: terminal.terminalId,

        ...summarizeTransactions(operations),
      };
    }
  );

  return {
    currency: "ARS",
    terminalCount: terminals.length,
    terminals: terminalSummary,
    totals: summarizeTransactions(transactions),
  };
}
