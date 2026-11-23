
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/get-user-role";
import {
  getOperationEconomics,
  isRefundOrCancellation,
  type EconomicTransaction,
  type PaymentCostSetting,
} from "@/lib/operaciones-economics";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Transaction = EconomicTransaction & {
  id: string;
  currency: string | null;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function getTransactions(
  dateFrom: string,
  dateTo: string
): Promise<Transaction[]> {
  const pageSize = 1000;
  let offset = 0;
  const transactions: Transaction[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("menta_transactions")
      .select(`
        id,
        operation_type,
        payment_method,
        gross_amount,
        merchant_net_amount,
        transaction_datetime,
        status,
        tax_info,
        currency
      `)
      .gte("transaction_datetime", dateFrom)
      .lt("transaction_datetime", dateTo)
      .order("transaction_datetime", {
        ascending: false,
      })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data || []) as Transaction[];
    transactions.push(...rows);

    if (rows.length < pageSize) break;

    offset += pageSize;
  }

  return transactions;
}

export async function GET(request: Request) {
  try {
    const role = await getUserRole();

    if (role !== "socio") {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const now = new Date();
    const defaultMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
    }).format(now);

    const month = searchParams.get("month") || defaultMonth;

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { ok: false, error: "Mes inválido." },
        { status: 400 }
      );
    }

    const [year, monthNumber] = month.split("-").map(Number);

    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;

    const dateFrom = `${month}-01T00:00:00-03:00`;
    const dateTo =
      `${nextYear}-${String(nextMonth).padStart(2, "0")}` +
      "-01T00:00:00-03:00";

    const [transactions, costsResult] = await Promise.all([
      getTransactions(dateFrom, dateTo),
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
        .order("valid_from", { ascending: false }),
    ]);

    if (costsResult.error) {
      throw new Error(costsResult.error.message);
    }

    const paymentCosts =
      (costsResult.data || []) as PaymentCostSetting[];

    const totals = {
      approvedOperations: 0,
      excludedOperations: 0,
      pendingEconomics: 0,
      processedVolume: 0,
      merchantFees: 0,
      acquirerCosts: 0,
      mentaCosts: 0,
      pandaCosts: 0,
      benefiProfit: 0,
      qrOperations: 0,
      cardOperations: 0,
      otherOperations: 0,
    };

    const currencies = new Set<string>();

    for (const transaction of transactions) {
      if (
        String(transaction.status || "").toUpperCase() !==
        "APPROVED" ||
        isRefundOrCancellation(transaction)
      ) {
        totals.excludedOperations++;
        continue;
      }

      const currency = String(
        transaction.currency || "ARS"
      ).toUpperCase();

      currencies.add(currency);

      // No mezclar importes de diferentes monedas.
      if (currency !== "ARS") {
        totals.excludedOperations++;
        continue;
      }

      totals.approvedOperations++;

      const grossAmount = Number(
        transaction.gross_amount || 0
      );

      totals.processedVolume += grossAmount;

      const method = String(
        transaction.payment_method || ""
      ).toUpperCase();

      if (method === "QR") {
        totals.qrOperations++;
      } else if (
        ["CREDIT", "DEBIT", "PREPAID"].includes(method)
      ) {
        totals.cardOperations++;
      } else {
        totals.otherOperations++;
      }

      const economics = getOperationEconomics(
        transaction,
        paymentCosts
      );

      if (!economics) {
        totals.pendingEconomics++;
        continue;
      }

      totals.merchantFees += economics.merchantFee;
      totals.acquirerCosts += economics.acquirerCost;
      totals.mentaCosts += economics.mentaCost;
      totals.pandaCosts += economics.pandaCost;
      totals.benefiProfit += economics.benefiProfit;
    }

    return NextResponse.json({
      ok: true,
      month,
      currency: "ARS",
      totals: {
        ...totals,
        processedVolume: roundMoney(totals.processedVolume),
        merchantFees: roundMoney(totals.merchantFees),
        acquirerCosts: roundMoney(totals.acquirerCosts),
        mentaCosts: roundMoney(totals.mentaCosts),
        pandaCosts: roundMoney(totals.pandaCosts),
        benefiProfit: roundMoney(totals.benefiProfit),
      },
      currenciesDetected: Array.from(currencies),
    });
  } catch (error) {
    console.error("Error Dashboard Socios:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cargar el Dashboard de Socios.",
      },
      { status: 500 }
    );
  }
}
