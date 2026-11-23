
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

function getCurrentArgentinaMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;

  return `${year}-${month}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, monthNumber - 1 + offset, 1)
  );

  return (
    `${date.getUTCFullYear()}-` +
    String(date.getUTCMonth() + 1).padStart(2, "0")
  );
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
      .order("transaction_datetime", { ascending: false })
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

    const month =
      searchParams.get("month") || getCurrentArgentinaMonth();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { ok: false, error: "Mes inválido." },
        { status: 400 }
      );
    }

    // Incluimos 12 meses hasta el mes seleccionado.
    const firstMonth = shiftMonth(month, -11);
    const nextMonth = shiftMonth(month, 1);

    const dateFrom = `${firstMonth}-01T00:00:00-03:00`;
    const dateTo = `${nextMonth}-01T00:00:00-03:00`;

    const monthlyRanges = Array.from(
        { length: 12 },
        (_, index) => {
            const currentMonth = shiftMonth(firstMonth, index);
            const followingMonth = shiftMonth(currentMonth, 1);

            return {
            dateFrom: `${currentMonth}-01T00:00:00-03:00`,
            dateTo: `${followingMonth}-01T00:00:00-03:00`,
            };
        }
        );

        const [monthlyTransactions, costsResult] = await Promise.all([
        Promise.all(
            monthlyRanges.map((range) =>
            getTransactions(range.dateFrom, range.dateTo)
            )
        ),
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

    const transactions = monthlyTransactions.flat();

    if (costsResult.error) {
      throw new Error(costsResult.error.message);
    }

    const paymentCosts =
      (costsResult.data || []) as PaymentCostSetting[];

    const months = Array.from({ length: 12 }, (_, index) => {
      const key = shiftMonth(firstMonth, index);

      return {
        month: key,
        approvedOperations: 0,
        pendingEconomics: 0,
        processedVolume: 0,
        merchantFees: 0,
        acquirerCosts: 0,
        mentaCosts: 0,
        pandaCosts: 0,
        benefiProfit: 0,
      };
    });

    const byMonth = new Map(
      months.map((item) => [item.month, item])
    );

    for (const transaction of transactions) {
      if (
        String(transaction.status || "").toUpperCase() !==
          "APPROVED" ||
        isRefundOrCancellation(transaction)
      ) {
        continue;
      }

      if (
        String(transaction.currency || "ARS").toUpperCase() !==
        "ARS"
      ) {
        continue;
      }

      if (!transaction.transaction_datetime) continue;

      const transactionMonth = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        }).format(new Date(transaction.transaction_datetime));

      const item = byMonth.get(transactionMonth);

      if (!item) continue;

      item.approvedOperations++;

      item.processedVolume += Number(
        transaction.gross_amount || 0
      );

      const economics = getOperationEconomics(
        transaction,
        paymentCosts
      );

      if (!economics) {
        item.pendingEconomics++;
        continue;
      }

      item.merchantFees += economics.merchantFee;
      item.acquirerCosts += economics.acquirerCost;
      item.mentaCosts += economics.mentaCost;
      item.pandaCosts += economics.pandaCost;
      item.benefiProfit += economics.benefiProfit;
    }

    const results = months.map((item, index) => {
      const previous = index > 0 ? months[index - 1] : null;

      const variationAmount = previous
        ? item.benefiProfit - previous.benefiProfit
        : null;

      const variationPercent =
        previous && previous.benefiProfit !== 0
          ? (variationAmount! / Math.abs(previous.benefiProfit)) *
            100
          : null;

      return {
        ...item,
        processedVolume: roundMoney(item.processedVolume),
        merchantFees: roundMoney(item.merchantFees),
        acquirerCosts: roundMoney(item.acquirerCosts),
        mentaCosts: roundMoney(item.mentaCosts),
        pandaCosts: roundMoney(item.pandaCosts),
        benefiProfit: roundMoney(item.benefiProfit),
        variationAmount:
          variationAmount === null
            ? null
            : roundMoney(variationAmount),
        variationPercent:
          variationPercent === null
            ? null
            : Math.round(variationPercent * 100) / 100,
      };
    });

    return NextResponse.json({
      ok: true,
      currency: "ARS",
      selectedMonth: month,
      fromMonth: firstMonth,
      toMonth: month,
      months: results,
    });
  } catch (error) {
    console.error("Error evolución Portal Socios:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cargar la evolución mensual.",
      },
      { status: 500 }
    );
  }
}
