import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mentaRequest } from "@/lib/menta/client";
import { getUserRole } from "@/lib/get-user-role";

type MentaTransaction = {
  customer_id?: string | null;
  merchant_id?: string | null;
  terminal_id?: string | null;
  transaction_id?: string | null;
  operation_id?: string | null;
  operation_number?: string | number | null;
  request_id?: string | null;
  serial_number?: string | null;

  operation_type?: string | null;
  payment_method?: string | null;
  gross_amount?: number | string | null;
  currency?: string | null;
  datetime?: string | null;
  status?: string | null;
  installments?: number | string | null;
  financing?: string | null;
  acquirer?: string | null;

  merchant_additional_info?: unknown;
  operation_additional_info?: unknown;
  operation_detail?: {
  reference_operation_id?: string | null;
  reference_operation_number?: string | number | null;

  card?: {
    card_bin?: string | null;
    card_mask?: string | null;
    card_brand?: string | null;
    is_international_card?: boolean | null;
  } | null;

  [key: string]: unknown;
} | null;
  tax_info?: {
  payment_date?: string | null;
  net_amount?: number | string | null;
} | null;
  user_info?: unknown;

  [key: string]: unknown;
};

type MentaTransactionResponse = {
  content?: MentaTransaction[];
  total_elements?: number;
  total_pages?: number;
  number_of_elements?: number;
  number?: number;
  first?: boolean;
  last?: boolean;
};

type PosDevice = {
  id: string;
  menta_terminal_id: string | null;
  merchant_id: string | null;
  merchant_branch_id: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value)
    .trim()
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value: unknown): number | null {
  const number = toNumber(value);

  if (number === null) {
    return null;
  }

  return Math.trunc(number);
}

function splitIntoChunks<T>(
  items: T[],
  chunkSize: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < items.length;
    index += chunkSize
  ) {
    chunks.push(
      items.slice(index, index + chunkSize)
    );
  }

  return chunks;
}

async function syncMentaTransactions() {
  try {
    

    const pageSize = 100;

    // 1. Obtener primera página
    const firstPage =
      await mentaRequest<MentaTransactionResponse>(
        `/v2/transaction-reports?page=0&size=${pageSize}`
      );

    const totalPages = Math.max(
      firstPage.total_pages ?? 1,
      1
    );

    const allTransactions: MentaTransaction[] = [
      ...(firstPage.content || []),
    ];

    // 2. Obtener las páginas restantes
    for (let page = 1; page < totalPages; page++) {
      const pageData =
        await mentaRequest<MentaTransactionResponse>(
          `/v2/transaction-reports?page=${page}&size=${pageSize}`
        );

      allTransactions.push(
        ...(pageData.content || [])
      );
    }

    // 3. Eliminar duplicados por operation_id
const uniqueTransactions =
  new Map<string, MentaTransaction>();

let skipped = 0;

for (const transaction of allTransactions) {
  const operationId =
    transaction.operation_id
      ? String(transaction.operation_id)
      : null;

  if (!operationId) {
    skipped++;
    continue;
  }

  uniqueTransactions.set(
    operationId,
    transaction
  );
}

const transactions =
  Array.from(uniqueTransactions.values());

    const referencedOperationIds = Array.from(
  new Set(
    transactions
      .filter(
        (transaction) =>
          transaction.operation_type === "ANNULMENT" ||
          transaction.operation_type === "REFUND"
      )
      .map(
        (transaction) =>
          transaction.operation_detail
            ?.reference_operation_id
      )
      .filter(
        (
          referenceOperationId
        ): referenceOperationId is string =>
          Boolean(referenceOperationId)
      )
  )
);

for (const referenceOperationId of referencedOperationIds) {
  const alreadyIncluded =
    transactions.some(
      (transaction) =>
        transaction.operation_id ===
        referenceOperationId
    );

  if (alreadyIncluded) {
    continue;
  }

  const referencedResponse =
    await mentaRequest<MentaTransactionResponse>(
      `/v2/transaction-reports?operationId=${encodeURIComponent(
        referenceOperationId
      )}&page=0&size=100`
    );

  const referencedTransactions =
    referencedResponse.content || [];

  for (const referencedTransaction of referencedTransactions) {
    const operationId =
      referencedTransaction.operation_id
        ? String(
            referencedTransaction.operation_id
          )
        : null;

    if (!operationId) {
      continue;
    }

    uniqueTransactions.set(
      operationId,
      referencedTransaction
    );
  }
}

const transactionsWithReferences =
  Array.from(
    uniqueTransactions.values()
  );

    // 4. Cargar POS BENEFÍ
    const { data: posDevices, error: posError } =
      await supabase
        .from("pos_devices")
        .select(
          "id, menta_terminal_id, merchant_id, merchant_branch_id"
        )
        .not("menta_terminal_id", "is", null);

    if (posError) {
      throw new Error(
        `No se pudieron cargar los POS BENEFÍ: ${posError.message}`
      );
    }

    const posByMentaTerminal = new Map<
      string,
      PosDevice
    >();

    for (const pos of (posDevices ||
      []) as PosDevice[]) {
      if (pos.menta_terminal_id) {
        posByMentaTerminal.set(
          String(pos.menta_terminal_id),
          pos
        );
      }
    }

    // 5. Preparar todas las filas antes de escribir
    const now = new Date().toISOString();

    let withoutPos = 0;

    const rows =
    transactionsWithReferences.map(
      (transaction) => {
        const transactionId = String(
          transaction.transaction_id
        );

        const terminalId =
          transaction.terminal_id
            ? String(transaction.terminal_id)
            : null;

        const pos = terminalId
          ? posByMentaTerminal.get(terminalId) ||
            null
          : null;

        if (!pos) {
          withoutPos++;
        }

        return {
          pos_id: pos?.id || null,

          merchant_id_benefi:
            pos?.merchant_id || null,

          merchant_branch_id_benefi:
            pos?.merchant_branch_id || null,

          customer_id_menta:
            transaction.customer_id
              ? String(transaction.customer_id)
              : null,

          merchant_id_menta:
            transaction.merchant_id
              ? String(transaction.merchant_id)
              : null,

          terminal_id_menta: terminalId,

          transaction_id: transactionId,

          operation_id:
            transaction.operation_id
              ? String(transaction.operation_id)
              : null,

          operation_number:
            transaction.operation_number !== null &&
            transaction.operation_number !== undefined
              ? String(
                  transaction.operation_number
                )
              : null,

          request_id:
            transaction.request_id
              ? String(transaction.request_id)
              : null,

          serial_number:
            transaction.serial_number
              ? String(transaction.serial_number)
              : null,

          operation_type:
            transaction.operation_type
              ? String(transaction.operation_type)
              : null,

          payment_method:
            transaction.payment_method
              ? String(transaction.payment_method)
              : null,

          gross_amount: toNumber(
            transaction.gross_amount
          ),

          currency:
            transaction.currency
              ? String(transaction.currency)
              : null,

          transaction_datetime:
            transaction.datetime
              ? String(transaction.datetime)
              : null,

          merchant_payment_date:
            transaction.tax_info?.payment_date
              ? String(
                  transaction.tax_info.payment_date
                ).slice(0, 10)
              : null,

          merchant_net_amount:
            toNumber(
              transaction.tax_info?.net_amount
            ),

          status:
            transaction.status
              ? String(transaction.status)
              : null,

          installments: toInteger(
            transaction.installments
          ),

          financing:
            transaction.financing
              ? String(transaction.financing)
              : null,

          acquirer:
            transaction.acquirer
              ? String(transaction.acquirer)
              : null,

          merchant_additional_info:
            transaction.merchant_additional_info ??
            null,

          operation_additional_info:
            transaction.operation_additional_info ??
            null,

          operation_detail:
            transaction.operation_detail ?? null,

          tax_info:
            transaction.tax_info ?? null,

          user_info:
            transaction.user_info ?? null,

          raw_payload: transaction,

          updated_at: now,
          synced_at: now,
        };
      }
    );

    // 6. Guardar por lotes
    const batchSize = 500;

    const batches = splitIntoChunks(
      rows,
      batchSize
    );

    let synced = 0;

    const errors: Array<{
      batch: number;
      error: string;
    }> = [];

    for (
      let index = 0;
      index < batches.length;
      index++
    ) {
      const batch = batches[index];

      const { error: syncError } =
        await supabase
          .from("menta_transactions")
          .upsert(batch, {
            onConflict: "operation_id",
          });

      if (syncError) {
        errors.push({
          batch: index + 1,
          error: syncError.message,
        });

        continue;
      }

      synced += batch.length;
    }

    return NextResponse.json({
      ok: errors.length === 0,

      summary: {
        received_from_menta:
          allTransactions.length,

        unique_transactions:
        transactionsWithReferences.length,

        duplicated_transactions:
          allTransactions.length -
          transactions.length -
          skipped,

        total_elements_menta:
          firstPage.total_elements ?? null,

        total_pages_menta: totalPages,

        synced,

        without_pos: withoutPos,

        skipped,

        batches: batches.length,

        errors: errors.length,
      },

      errors,
    });
  } catch (error) {
    console.error(
      "Error sincronizando transacciones MENTA:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudieron sincronizar las transacciones de MENTA.",
      },
      { status: 500 }
    );
  }
}
export async function POST() {
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
          "No tenés permisos para sincronizar operaciones con MENTA.",
      },
      { status: 403 }
    );
  }

  return syncMentaTransactions();
}

export async function GET(
  request: Request
) {
  const cronSecret =
    process.env.CRON_SECRET;

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !cronSecret ||
    authorization !==
      `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "No autorizado.",
      },
      { status: 401 }
    );
  }

  return syncMentaTransactions();
}