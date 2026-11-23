

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
  merchant_id_benefi: string | null;
  currency: string | null;
};

type ConsolidatedTotals = {
  approvedOperations: number;
  pendingEconomics: number;
  processedVolume: number;
  merchantFees: number;
  acquirerCosts: number;
  mentaCosts: number;
  pandaCosts: number;
  benefiProfit: number;
};

type ConsolidatedGroup = ConsolidatedTotals & {
  paymentMethod: string;
};

type MerchantGroup = ConsolidatedTotals & {
  merchantId: string | null;
  merchantName: string;
  paymentMethods: ConsolidatedGroup[];
};

function emptyTotals(): ConsolidatedTotals {
  return {
    approvedOperations: 0,
    pendingEconomics: 0,
    processedVolume: 0,
    merchantFees: 0,
    acquirerCosts: 0,
    mentaCosts: 0,
    pandaCosts: 0,
    benefiProfit: 0,
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function finalizeTotals<T extends ConsolidatedTotals>(value: T) {
  return {
    ...value,
    processedVolume: roundMoney(value.processedVolume),
    merchantFees: roundMoney(value.merchantFees),
    acquirerCosts: roundMoney(value.acquirerCosts),
    mentaCosts: roundMoney(value.mentaCosts),
    pandaCosts: roundMoney(value.pandaCosts),
    benefiProfit: roundMoney(value.benefiProfit),
    marginOnVolume:
      value.processedVolume !== 0
        ? (value.benefiProfit / value.processedVolume) * 100
        : 0,
    marginOnCommissions:
      value.merchantFees !== 0
        ? (value.benefiProfit / value.merchantFees) * 100
        : 0,
  };
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
        merchant_id_benefi,
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

    if (error) throw new Error(error.message);

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

    const defaultMonth = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());

    const month = searchParams.get("month") || defaultMonth;

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { ok: false, error: "Mes invÃ¡lido." },
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

    const [transactions, costsResult, merchantsResult] =
      await Promise.all([
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
        supabase.from("merchants").select("id,name"),
      ]);

    if (costsResult.error) {
      throw new Error(costsResult.error.message);
    }

    if (merchantsResult.error) {
      throw new Error(merchantsResult.error.message);
    }

    const paymentCosts =
      (costsResult.data || []) as PaymentCostSetting[];

    const merchantNames = new Map<string, string>(
      (merchantsResult.data || []).map((merchant) => [
        merchant.id,
        merchant.name,
      ])
    );

    const merchants = new Map<string, MerchantGroup>();
    const methodMaps = new Map<
      string,
      Map<string, ConsolidatedGroup>
    >();

    const totals = emptyTotals();
    let excludedOperations = 0;

    for (const transaction of transactions) {
      if (
        String(transaction.status || "").toUpperCase() !==
          "APPROVED" ||
        isRefundOrCancellation(transaction)
      ) {
        excludedOperations++;
        continue;
      }

      const currency = String(
        transaction.currency || "ARS"
      ).toUpperCase();

      if (currency !== "ARS") {
        excludedOperations++;
        continue;
      }

      const merchantId = transaction.merchant_id_benefi;
      const key = merchantId || "__unlinked__";
      const merchantName = merchantId
        ? merchantNames.get(merchantId) || "Comercio sin identificar"
        : "Sin vincular";

      let merchantGroup = merchants.get(key);

      if (!merchantGroup) {
        merchantGroup = {
          ...emptyTotals(),
          merchantId,
          merchantName,
          paymentMethods: [],
        };
        merchants.set(key, merchantGroup);
        methodMaps.set(key, new Map());
      }

      const method = String(
        transaction.payment_method || "OTHER"
      ).toUpperCase();

      const methods = methodMaps.get(key)!;
      let methodGroup = methods.get(method);

      if (!methodGroup) {
        methodGroup = {
          ...emptyTotals(),
          paymentMethod: method,
        };
        methods.set(method, methodGroup);
      }

      const gross = Number(transaction.gross_amount || 0);
      const economics = getOperationEconomics(
        transaction,
        paymentCosts
      );

      const targets = [totals, merchantGroup, methodGroup];

      for (const target of targets) {
        target.approvedOperations++;
        target.processedVolume += gross;

        if (!economics) {
          target.pendingEconomics++;
          continue;
        }

        target.merchantFees += economics.merchantFee;
        target.acquirerCosts += economics.acquirerCost;
        target.mentaCosts += economics.mentaCost;
        target.pandaCosts += economics.pandaCost;
        target.benefiProfit += economics.benefiProfit;
      }
    }

    const consolidatedMerchants = Array.from(
      merchants.entries()
    )
      .map(([key, merchant]) => ({
        ...finalizeTotals(merchant),
        paymentMethods: Array.from(
          methodMaps.get(key)!.values()
        )
          .map(finalizeTotals)
          .sort(
            (a, b) =>
              b.processedVolume - a.processedVolume
          ),
      }))
      .sort(
        (a, b) =>
          b.processedVolume - a.processedVolume
      );

    return NextResponse.json({
      ok: true,
      month,
      currency: "ARS",
      totals: {
        ...finalizeTotals(totals),
        excludedOperations,
      },
      merchants: consolidatedMerchants,
    });
  } catch (error) {
    console.error("Error consolidado socios:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cargar el consolidado de socios.",
      },
      { status: 500 }
    );
  }
}
