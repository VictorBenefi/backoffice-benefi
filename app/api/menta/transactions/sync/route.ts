import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mentaRequest } from "@/lib/menta/client";
import { getUserRole } from "@/lib/get-user-role";
import { getAuthUserId } from "@/lib/get-auth-user-id";
import {
  createRecoveryToken,
  verifyRecoveryToken,
} from "@/lib/menta-recovery-token";

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

export const maxDuration = 300;

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
function normalizeForComparison(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (Array.isArray(value)) {
    return `[${value
      .map((item) =>
        normalizeForComparison(item)
      )
      .join(",")}]`;
  }

  if (typeof value === "object") {
    const objectValue =
      value as Record<string, unknown>;

    const sortedEntries =
      Object.keys(objectValue)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${normalizeForComparison(
              objectValue[key]
            )}`
        );

    return `{${sortedEntries.join(",")}}`;
  }

  return JSON.stringify(value);
}

async function syncMentaTransactions(options?: {
  start?: string;
  end?: string;
  dryRun?: boolean;
  historical?: boolean;
}) {
  let lockToken: string | null = null;

  try {
    // En modo de prueba no adquirir el bloqueo de producción.
    if (!options?.dryRun) {
      const { data: acquiredToken, error: lockError } =
        await supabase.rpc("acquire_menta_sync_lock", {
          p_lock_name: "menta_transactions",
          p_duration_seconds: 900,
        });

      if (lockError) {
        throw new Error(
          `Error adquiriendo bloqueo MENTA: ${lockError.message}`
        );
      }

      if (!acquiredToken) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason:
            "Ya existe una sincronización MENTA en ejecución.",
        });
      }

      lockToken = acquiredToken;
    }



    const pageSize = 100;
    const dateParams = new URLSearchParams();

    if (options?.start) {
      dateParams.set("start", options.start);
    }

    if (options?.end) {
      dateParams.set("end", options.end);
    }

    const dateQuery =
      dateParams.toString()
        ? `&${dateParams.toString()}`
        : "";

    // 1. Obtener primera página
    const firstPage =
      await mentaRequest<MentaTransactionResponse>(
        `/v2/transaction-reports?page=0&size=${pageSize}${dateQuery}`
      );

    if (!Array.isArray(firstPage.content)) {
      throw new Error("MENTA devolvió una primera página sin operaciones válidas.");
    }

    const totalPages = Math.max(firstPage.total_pages ?? 1, 1);
    if (!Number.isInteger(totalPages) || totalPages > 100) {
      throw new Error(`Paginación MENTA fuera del límite seguro: ${totalPages} páginas.`);
    }

    const allTransactions: MentaTransaction[] = [
      ...(firstPage.content || []),
    ];

    // 2. Obtener las páginas restantes
    for (let page = 1; page < totalPages; page++) {
      const pageData =
      await mentaRequest<MentaTransactionResponse>(
        `/v2/transaction-reports?page=${page}&size=${pageSize}${dateQuery}`
      );

      if (!Array.isArray(pageData.content) || pageData.content.length === 0) {
        throw new Error(`MENTA devolvió la página ${page} vacía o inválida.`);
      }
      allTransactions.push(...pageData.content);
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

    // 5. Cargar operaciones ya existentes
    const operationIds =
      transactionsWithReferences
        .map((transaction) =>
          transaction.operation_id
            ? String(transaction.operation_id)
            : null
        )
        .filter(
          (operationId): operationId is string =>
            Boolean(operationId)
        );

    const existingTransactions: Array<{
      operation_id: string | null;
      pos_id: string | null;
      merchant_id_benefi: string | null;
      merchant_branch_id_benefi: string | null;
      status: string | null;
      merchant_payment_date: string | null;
      merchant_net_amount: number | null;
      payment_method: string | null;
      gross_amount: number | null;
      installments: number | null;
      financing: string | null;
      acquirer: string | null;
      operation_type: string | null;
      operation_detail: unknown;
      tax_info: unknown;
    }> = [];

    const operationIdChunks =
      splitIntoChunks(operationIds, 100);

    for (const operationIdChunk of operationIdChunks) {
      const { data, error } =
        await supabase
          .from("menta_transactions")
          .select(
              "operation_id, pos_id, merchant_id_benefi, merchant_branch_id_benefi, status, merchant_payment_date, merchant_net_amount, payment_method, gross_amount, installments, financing, acquirer, operation_type, operation_detail, tax_info"
            )
          .in("operation_id", operationIdChunk);

      if (error) {
        throw new Error(
          `No se pudieron verificar las operaciones existentes: ${error.message}`
        );
      }

      existingTransactions.push(
        ...(data || [])
      );
    }

    const existingByOperationId = new Map(
      (existingTransactions || []).map(
        (transaction) => [
          String(transaction.operation_id),
          transaction,
        ]
      )
    );

    const newOperationsCount =
    operationIds.filter(
      (operationId) =>
        !existingByOperationId.has(operationId)
    ).length;

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

        const existingTransaction =
        transaction.operation_id
          ? existingByOperationId.get(
              String(transaction.operation_id)
            )
          : null;

        return {
          pos_id:
            existingTransaction?.pos_id ??
            pos?.id ??
            null,

          merchant_id_benefi:
            existingTransaction?.merchant_id_benefi ??
            pos?.merchant_id ??
            null,

          merchant_branch_id_benefi:
            existingTransaction?.merchant_branch_id_benefi ??
            pos?.merchant_branch_id ??
            null,

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

    const changedOperationsCount =
    rows.filter((row) => {
      if (!row.operation_id) {
        return false;
      }

      const existing =
        existingByOperationId.get(
          row.operation_id
        );

      if (!existing) {
        return false;
      }

    return (
      normalizeForComparison(existing.status) !==
        normalizeForComparison(row.status) ||
      normalizeForComparison(
        existing.merchant_payment_date
      ) !==
        normalizeForComparison(
          row.merchant_payment_date
        ) ||
      normalizeForComparison(
        existing.merchant_net_amount
      ) !==
        normalizeForComparison(
          row.merchant_net_amount
        ) ||
      normalizeForComparison(
        existing.payment_method
      ) !==
        normalizeForComparison(
          row.payment_method
        ) ||
      normalizeForComparison(
        existing.gross_amount
      ) !==
        normalizeForComparison(
          row.gross_amount
        ) ||
      normalizeForComparison(
        existing.installments
      ) !==
        normalizeForComparison(
          row.installments
        ) ||
      normalizeForComparison(
        existing.financing
      ) !==
        normalizeForComparison(
          row.financing
        ) ||
      normalizeForComparison(
        existing.acquirer
      ) !==
        normalizeForComparison(
          row.acquirer
        ) ||
      normalizeForComparison(
        existing.operation_type
      ) !==
        normalizeForComparison(
          row.operation_type
        ) ||
      normalizeForComparison(
        existing.operation_detail
      ) !==
        normalizeForComparison(
          row.operation_detail
        ) ||
      normalizeForComparison(
        existing.tax_info
      ) !==
        normalizeForComparison(
          row.tax_info
        )
    );
  }).length;

  const rowsToSync =
  rows.filter((row) => {
    if (!row.operation_id) {
      return false;
    }

    const existing =
      existingByOperationId.get(
        row.operation_id
      );

    // Operación nueva
    if (!existing) {
      return true;
    }

    // Operación existente pero modificada
    return (
      normalizeForComparison(existing.status) !==
        normalizeForComparison(row.status) ||
      normalizeForComparison(
        existing.merchant_payment_date
      ) !==
        normalizeForComparison(
          row.merchant_payment_date
        ) ||
      normalizeForComparison(
        existing.merchant_net_amount
      ) !==
        normalizeForComparison(
          row.merchant_net_amount
        ) ||
      normalizeForComparison(
        existing.payment_method
      ) !==
        normalizeForComparison(
          row.payment_method
        ) ||
      normalizeForComparison(
        existing.gross_amount
      ) !==
        normalizeForComparison(
          row.gross_amount
        ) ||
      normalizeForComparison(
        existing.installments
      ) !==
        normalizeForComparison(
          row.installments
        ) ||
      normalizeForComparison(
        existing.financing
      ) !==
        normalizeForComparison(
          row.financing
        ) ||
      normalizeForComparison(
        existing.acquirer
      ) !==
        normalizeForComparison(
          row.acquirer
        ) ||
      normalizeForComparison(
        existing.operation_type
      ) !==
        normalizeForComparison(
          row.operation_type
        ) ||
      normalizeForComparison(
        existing.operation_detail
      ) !==
        normalizeForComparison(
          row.operation_detail
        ) ||
      normalizeForComparison(
        existing.tax_info
      ) !==
        normalizeForComparison(
          row.tax_info
        )
    );
  });

  // Modo de prueba: no guardar operaciones en Supabase

const missingOperations = options?.dryRun
  ? rows
      .filter(
        (row) =>
          row.operation_id &&
          !existingByOperationId.has(row.operation_id)
      )
      .map((row) => ({
        operation_id: row.operation_id,
        datetime: row.transaction_datetime,
        terminal_id: row.terminal_id_menta,
        merchant_id: row.merchant_id_menta,
        status: row.status,
        operation_type: row.operation_type,
        gross_amount: row.gross_amount,
      }))
  : [];

  if (options?.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      missing_operations: missingOperations,
      message:
        "Simulación completada. No se modificaron operaciones.",
      summary: {
        received_from_menta: allTransactions.length,
        total_pages_menta: totalPages,
        total_elements_menta: firstPage.total_elements ?? null,
        synced: 0,
        unique_transactions: transactionsWithReferences.length,
        new_operations: newOperationsCount,
        changed_operations: changedOperationsCount,
        without_pos: withoutPos,
        skipped,
        operations_that_would_sync: rowsToSync.length,
      },
    });
  }

    // 6. Guardar por lotes
    const batchSize = 500;

    const batches = splitIntoChunks(
      rowsToSync,
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

        // En la conciliación histórica, detener el proceso
        // si falla el guardado de un lote.
        if (options?.historical) {
          break;
        }

        // Mantener el comportamiento del cron rápido.
        continue;
      }


      synced += batch.length;
    }

    if (options?.historical && errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La conciliación histórica no pudo completar el guardado de todas las operaciones.",
          summary: {
            synced,
            failed_batches: errors.length,
          },
          errors,
        },
        { status: 500 }
      );
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

        new_operations: newOperationsCount,

        changed_operations: changedOperationsCount,

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
  } finally {
    if (lockToken) {
      const { error: releaseError } =
        await supabase.rpc("release_menta_sync_lock", {
          p_lock_name: "menta_transactions",
          p_lock_token: lockToken,
        });

      if (releaseError) {
        console.error(
          "Error liberando bloqueo MENTA:",
          releaseError.message
        );
      }
    }
  }
}


export async function POST(request: Request) {
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
        error: "No tenés permisos para sincronizar operaciones con MENTA.",
      },
      { status: 403 }
    );
  }

  const isLocalDevelopment =
    process.env.NODE_ENV === "development";

    console.log("[MENTA RECOVERY] Diagnóstico de entorno", {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      isLocalDevelopment,
      recoverySecretConfigured:
        Boolean(process.env.MENTA_RECOVERY_SECRET),
    });

  
  // Recuperación puntual administrativa
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    let body: {
      action?: string;
      start?: string;
      end?: string;
      recoveryToken?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Solicitud JSON inválida." },
        { status: 400 }
      );
    }

    if (body?.action !== "verify" && body?.action !== "recover") {
      return NextResponse.json(
        { ok: false, error: "Acción administrativa inválida." },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "supervisor") {
      return NextResponse.json(
        { ok: false, error: "No tenés permisos para recuperar operaciones." },
        { status: 403 }
      );
    }

    const userId = await getAuthUserId();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sesión no válida." },
        { status: 401 }
      );
    }

    if (
      typeof body.start !== "string" ||
      typeof body.end !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "Debés indicar fecha y hora de inicio y fin." },
        { status: 400 }
      );
    }

    const start = new Date(body.start);
    const end = new Date(body.end);

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start.getTime() >= end.getTime()
    ) {
      return NextResponse.json(
        { ok: false, error: "El rango de fechas es inválido." },
        { status: 400 }
      );
    }

    const maximumRangeMs = 24 * 60 * 60 * 1000;

    if (end.getTime() - start.getTime() > maximumRangeMs) {
      return NextResponse.json(
        {
          ok: false,
          error: "El rango máximo permitido es de 24 horas.",
        },
        { status: 400 }
      );
    }

    if (end.getTime() > Date.now()) {
      return NextResponse.json(
        { ok: false, error: "No se permiten fechas futuras." },
        { status: 400 }
      );
    }

    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // 1. Verificar sin modificar operaciones.
if (body.action === "verify") {
  const chunks: Array<{
    start: string;
    end: string;
    result: Record<string, unknown>;
  }> = [];

  const oneHourMs = 60 * 60 * 1000;
 for (
    let cursor = start.getTime();
    cursor < end.getTime();
    cursor += oneHourMs
  ) {

    const chunkStart = new Date(cursor).toISOString();
    const chunkEnd = new Date(
      Math.min(cursor + oneHourMs, end.getTime())
    ).toISOString();

    const response = await syncMentaTransactions({
      start: chunkStart,
      end: chunkEnd,
      dryRun: true,
      historical: true,
    });

    const chunkResult = await response.json();

    if (
      !response.ok ||
      chunkResult.ok !== true ||
      chunkResult.skipped === true
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falló la verificación de uno de los períodos.",
          failedPeriod: {
            start: chunkStart,
            end: chunkEnd,
          },
          detail: chunkResult,
        },
        { status: response.ok ? 500 : response.status }
      );
    }

    chunks.push({
      start: chunkStart,
      end: chunkEnd,
      result: chunkResult,
    });
  }

  const summary: Record<string, number> = {};

  for (const chunk of chunks) {
    const chunkSummary = chunk.result.summary;

    if (
      chunkSummary &&
      typeof chunkSummary === "object" &&
      !Array.isArray(chunkSummary)
    ) {
      for (const [key, value] of Object.entries(chunkSummary)) {
        if (typeof value === "number") {
          summary[key] = (summary[key] ?? 0) + value;
        }
      }
    }
  }

      const result = {
        ok: true,
        dryRun: true,
        summary,
        periods: chunks.length,
        missing_operations: chunks.flatMap((chunk) =>
          Array.isArray(chunk.result.missing_operations)
            ? chunk.result.missing_operations
            : []
        ),
      };

          if (result.ok !== true) {
      return NextResponse.json(
        result,
        { status: 500 }
      );
    }

      // En desarrollo solo verificamos.
      if (isLocalDevelopment) {
        return NextResponse.json({
          ...result,
          recoveryToken: null,
          recoveryEnabled: false,
        });
      }

      const recoveryToken = createRecoveryToken(
        userId,
        startISO,
        endISO
      );

      return NextResponse.json({
        ...result,
        recoveryToken,
        recoveryEnabled: true,
      });
    }


    // 2. Recuperar únicamente con autorización válida.
    if (isLocalDevelopment) {
      return NextResponse.json(
        {
          ok: false,
          error: "La recuperación real está deshabilitada en desarrollo.",
        },
        { status: 403 }
      );
    }

    if (typeof body.recoveryToken !== "string") {
      return NextResponse.json(
        { ok: false, error: "Falta la autorización de recuperación." },
        { status: 403 }
      );
    }

    const authorization = verifyRecoveryToken(
      body.recoveryToken,
      userId,
      startISO,
      endISO
    );

    if (!authorization) {
      return NextResponse.json(
        {
          ok: false,
          error: "La autorización es inválida o venció. Verificá nuevamente.",
        },
        { status: 403 }
      );
    }

    // 3. Consumir la autorización una sola vez.
    const { data: consumed, error: consumeError } =
      await supabase.rpc("consume_menta_recovery_token", {
        p_jti: authorization.jti,
        p_user_id: authorization.userId,
        p_start_at: authorization.start,
        p_end_at: authorization.end,
        p_expires_at: new Date(
          authorization.expiresAt
        ).toISOString(),
      });

    if (consumeError) {
      console.error(
        "Error consumiendo autorización MENTA:",
        consumeError.message
      );

      return NextResponse.json(
        { ok: false, error: "No se pudo validar la autorización." },
        { status: 500 }
      );
    }

    if (consumed !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "Esta autorización ya fue utilizada o venció.",
        },
        { status: 409 }
      );
    }

    // 4. Bloqueo exclusivo de recuperación administrativa.
    const recoveryLockName = "menta_transactions_admin_recovery";

    const { data: recoveryLockToken, error: recoveryLockError } =
      await supabase.rpc("acquire_menta_sync_lock", {
        p_lock_name: recoveryLockName,
        p_duration_seconds: 900,
      });

    if (recoveryLockError) {
      console.error(
        "Error adquiriendo bloqueo administrativo MENTA:",
        recoveryLockError.message
      );

      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo iniciar el bloqueo de recuperación.",
        },
        { status: 500 }
      );
    }

    if (!recoveryLockToken) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ya existe una recuperación administrativa MENTA en ejecución.",
        },
        { status: 409 }
      );
    }

    try {
      // 5. Recuperar el período por tramos de una hora.
      const oneHourMs = 60 * 60 * 1000;

      const recoveryStartedAt = Date.now();
      const recoveryBudgetMs = 240_000;

      const recoverySummary: Record<string, number> = {};
      let completedPeriods = 0;

      for (
        let cursor = start.getTime();
        cursor < end.getTime();
        cursor += oneHourMs
      ) {
        // Evitar iniciar otro tramo cerca del límite de Vercel.
        if (Date.now() - recoveryStartedAt >= recoveryBudgetMs) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "La recuperación se detuvo por el límite de tiempo preventivo.",
              completedPeriods,
              summary: recoverySummary,
              message:
                "Los tramos anteriores pueden haberse guardado. Verificá nuevamente antes de continuar.",
            },
            { status: 409 }
          );
        }

        const chunkStart = new Date(cursor).toISOString();
        const chunkEnd = new Date(
          Math.min(cursor + oneHourMs, end.getTime())
        ).toISOString();

        const response = await syncMentaTransactions({
          start: chunkStart,
          end: chunkEnd,
          historical: true,
        });

        const chunkResult = await response.json();

        if (
          !response.ok ||
          chunkResult.ok !== true ||
          chunkResult.skipped === true
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: "La recuperación no pudo completarse.",
              completedPeriods,
              failedPeriod: {
                start: chunkStart,
                end: chunkEnd,
              },
              summary: recoverySummary,
              detail: chunkResult,
              message:
                "Los tramos anteriores pueden haberse guardado. Verificá nuevamente antes de reintentar.",
            },
            { status: response.ok ? 500 : response.status }
          );
        }

        completedPeriods++;

        const chunkSummary = chunkResult.summary;

        if (
          chunkSummary &&
          typeof chunkSummary === "object" &&
          !Array.isArray(chunkSummary)
        ) {
          for (const [key, value] of Object.entries(chunkSummary)) {
            if (typeof value === "number") {
              recoverySummary[key] =
                (recoverySummary[key] ?? 0) + value;
            }
          }
        }
      }

      return NextResponse.json({
        ok: true,
        message: "Recuperación del período completada.",
        completedPeriods,
        summary: recoverySummary,
      });
    } finally {
      // Liberar el bloqueo administrativo incluso si hay errores.
      const { error: releaseError } = await supabase.rpc(
        "release_menta_sync_lock",
        {
          p_lock_name: recoveryLockName,
          p_lock_token: recoveryLockToken,
        }
      );

      if (releaseError) {
        console.error(
          "Error liberando bloqueo administrativo MENTA:",
          releaseError.message
        );
      }
    }
  }

  // Mantener el comportamiento manual existente.
  if (isLocalDevelopment) {
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60 * 1000);

    return syncMentaTransactions({
      start: start.toISOString(),
      end: end.toISOString(),
      dryRun: true,
    });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);

  return syncMentaTransactions({
    start: start.toISOString(),
    end: end.toISOString(),
  });
}

// La sincronización histórica tiene un bloqueo propio para evitar
// dos procesos históricos concurrentes; cada ventana conserva el
// bloqueo de transacciones que comparte con el cron rápido.
const HISTORY_NAME = "menta_transactions_history";
const HISTORY_LOCK = "menta_transactions_history_runner";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_WINDOW_LIMIT = 8;
const HISTORY_BUDGET_MS = 150_000;

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "development") {
    return NextResponse.json(
      { ok: false, error: "Sincronización GET deshabilitada en desarrollo para proteger producción." },
      { status: 403 }
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const mode = new URL(request.url).searchParams.get("mode");
  if (mode === "fast") {
    const end = new Date();
    return syncMentaTransactions({
      start: new Date(end.getTime() - 2 * HOUR_MS).toISOString(),
      end: end.toISOString(),
    });
  }
  if (mode !== null && mode !== "history") {
    return NextResponse.json({ ok: false, error: "Modo de sincronización inválido." }, { status: 400 });
  }

  let historyToken: string | null = null;
  const startedAt = Date.now();
  const completed: Array<{
    start: string;
    end: string;
    synced: number;
    new_operations: number;
    changed_operations: number;
    without_pos: number;
  }> = [];

  try {
    const { data: acquiredToken, error: lockError } = await supabase.rpc(
      "acquire_menta_sync_lock",
      { p_lock_name: HISTORY_LOCK, p_duration_seconds: 900 }
    );
    if (lockError) throw new Error(`No se pudo bloquear el proceso histórico: ${lockError.message}`);
    if (!acquiredToken) {
      return NextResponse.json({ ok: true, historical: true, skipped: true, reason: "Ya existe una recuperación histórica en ejecución." });
    }
    historyToken = acquiredToken;

    for (let i = 0; i < HISTORY_WINDOW_LIMIT; i++) {
      if (Date.now() - startedAt >= HISTORY_BUDGET_MS) break;

      const { data: progress, error: readError } = await supabase
        .from("menta_sync_progress")
        .select("next_window_start")
        .eq("sync_name", HISTORY_NAME)
        .single();
      if (readError || !progress) {
        throw new Error(`No se pudo leer el cursor histórico: ${readError?.message ?? "sin registro"}`);
      }

      const cursor = new Date(progress.next_window_start);
      if (Number.isNaN(cursor.getTime())) throw new Error("Cursor histórico inválido.");
      const now = new Date();
      const oldestAllowed = new Date(now.getTime() - 30 * DAY_MS);
      const windowStart = new Date(Math.max(cursor.getTime(), oldestAllowed.getTime()));

      // Al completar un barrido, iniciar otro para revisar correcciones
      // tardías de MENTA dentro de los últimos 30 días.
      if (windowStart.getTime() >= now.getTime()) {
        const { data: resetRows, error: resetError } = await supabase
          .from("menta_sync_progress")
          .update({ next_window_start: oldestAllowed.toISOString(), updated_at: now.toISOString() })
          .eq("sync_name", HISTORY_NAME)
          .eq("next_window_start", progress.next_window_start)
          .select("sync_name");
        if (resetError || resetRows?.length !== 1) {
          throw new Error(`No se pudo reiniciar el barrido histórico: ${resetError?.message ?? "cursor modificado"}`);
        }
        break;
      }

      const windowEnd = new Date(Math.min(windowStart.getTime() + HOUR_MS, now.getTime()));
      const response = await syncMentaTransactions({
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        historical: true,
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.skipped === true) {
        const reason = result.skipped
          ? "La sincronización rápida está utilizando el bloqueo compartido."
          : result.error ?? "La ventana histórica falló.";
        // Se conserva el cursor para reintentar la misma ventana.
        return NextResponse.json(
          { ok: false, historical: true, cursor_advanced: completed.length > 0,
            windows_completed: completed.length, completed, failed_window: {
              start: windowStart.toISOString(), end: windowEnd.toISOString(), reason,
            } },
          { status: result.skipped ? 409 : 500 }
        );
      }

      const completedAt = new Date().toISOString();
      const { data: updatedRows, error: updateError } = await supabase
        .from("menta_sync_progress")
        .update({
          next_window_start: windowEnd.toISOString(),
          last_completed_at: completedAt,
          updated_at: completedAt,
        })
        .eq("sync_name", HISTORY_NAME)
        .eq("next_window_start", progress.next_window_start)
        .select("sync_name");
      if (updateError || updatedRows?.length !== 1) {
        throw new Error(`La ventana se guardó pero no se pudo avanzar el cursor: ${updateError?.message ?? "cursor modificado"}`);
      }

      completed.push({
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        synced: result.summary?.synced ?? 0,
        new_operations: result.summary?.new_operations ?? 0,
        changed_operations: result.summary?.changed_operations ?? 0,
        without_pos: result.summary?.without_pos ?? 0,
      });
    }

    return NextResponse.json({
      ok: true,
      historical: true,
      windows_completed: completed.length,
      cursor_advanced: completed.length > 0,
      completed,
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Error en recuperación histórica MENTA:", error);
    return NextResponse.json(
      { ok: false, historical: true, cursor_advanced: completed.length > 0,
        windows_completed: completed.length, completed,
        error: error instanceof Error ? error.message : "Error histórico desconocido." },
      { status: 500 }
    );
  } finally {
    if (historyToken) {
      const { error } = await supabase.rpc("release_menta_sync_lock", {
        p_lock_name: HISTORY_LOCK,
        p_lock_token: historyToken,
      });
      if (error) console.error("Error liberando bloqueo histórico MENTA:", error.message);
    }
  }
}
