
import "server-only";
import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type {
  ShiftTerminal,
} from "@/lib/pos-shift-summary";

import {
  getMentaShiftTransactions,
} from "@/lib/menta/shift-transactions";

import {
  getPosShiftDataSource,
} from "@/lib/pos/shift-data-source";

import {
  buildPosShiftSummary,
} from "@/lib/pos-shift-summary";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type PreviousClosureTerminal = {
  id: string;
  closure_id: string;
  pos_id: string;
  period_from: string;
  period_to: string;
  last_transaction_at: string | null;
};

export type ShiftTerminalPeriod = ShiftTerminal & {
  isFirstClosure: boolean;
  previousClosureTerminalId: string | null;
  periodFrom: string | null;
};

async function getPreviousClosure(
  posId: string
): Promise<PreviousClosureTerminal | null> {
  const { data, error } = await supabase
    .from("pos_shift_closure_terminals")
    .select(`
      id,
      closure_id,
      pos_id,
      period_from,
      period_to,
      last_transaction_at,
      pos_shift_closures!inner (
        closure_number
      )
    `)
    .eq("pos_id", posId)
    .order("pos_shift_closures(closure_number)", {
        ascending: false,
        })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar el último cierre: ${error.message}`
    );
  }

  return data as PreviousClosureTerminal | null;
}

export async function getShiftTerminalPeriods(
  terminals: ShiftTerminal[]
): Promise<ShiftTerminalPeriod[]> {
  if (terminals.length === 0) {
    throw new Error(
      "No se seleccionaron terminales."
    );
  }

  const posIds = new Set<string>();
  const terminalIds = new Set<string>();

  for (const terminal of terminals) {
    if (
      !terminal.posId.trim() ||
      !terminal.terminalId.trim() ||
      posIds.has(terminal.posId) ||
      terminalIds.has(terminal.terminalId)
    ) {
      throw new Error(
        "Terminales inválidas o duplicadas."
      );
    }

    posIds.add(terminal.posId);
    terminalIds.add(terminal.terminalId);
  }

  const periods: ShiftTerminalPeriod[] = [];

  for (const terminal of terminals) {
    const previousClosure =
      await getPreviousClosure(
        terminal.posId
      );

    if (!previousClosure) {
  const { data: device, error: deviceError } =
    await supabase
      .from("pos_devices")
      .select("shift_closure_enabled_from")
      .eq("id", terminal.posId)
      .maybeSingle();

  if (deviceError) {
    throw new Error(
      `No se pudo consultar la habilitación de la terminal ${terminal.code}.`
    );
  }

  if (!device?.shift_closure_enabled_from) {
    throw new Error(
      `La terminal ${terminal.code} todavía no tiene habilitado su primer cierre de turno.`
    );
  }

  const enabledFrom = Date.parse(
    device.shift_closure_enabled_from
  );

  if (
    !Number.isFinite(enabledFrom) ||
    enabledFrom >= Date.now()
  ) {
    throw new Error(
      `La fecha de habilitación de la terminal ${terminal.code} no es válida o todavía no ha comenzado.`
    );
  }

  periods.push({
    ...terminal,
    isFirstClosure: true,
    previousClosureTerminalId: null,
    periodFrom: new Date(enabledFrom).toISOString(),
  });

  continue;
}

    const periodFrom =
        previousClosure.period_to;

    if (
      !Number.isFinite(
        Date.parse(periodFrom)
      )
    ) {
      throw new Error(
        `La terminal ${terminal.code} tiene una fecha de cierre inválida.`
      );
    }

    periods.push({
      ...terminal,
      isFirstClosure: false,
      previousClosureTerminalId:
        previousClosure.id,
      periodFrom,
    });
  }

  return periods;
}


export async function getAlreadyClosedOperationIds(
  operationIds: string[]
): Promise<Set<string>> {
  const uniqueIds = Array.from(
    new Set(
      operationIds
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );

  const closedOperationIds = new Set<string>();

  if (uniqueIds.length === 0) {
    return closedOperationIds;
  }

  const chunkSize = 100;

  for (
    let index = 0;
    index < uniqueIds.length;
    index += chunkSize
  ) {
    const chunk = uniqueIds.slice(
      index,
      index + chunkSize
    );

    const { data, error } = await supabase
      .from("pos_shift_closure_transactions")
      .select("operation_id")
      .in("operation_id", chunk);

    if (error) {
      throw new Error(
        `No se pudieron verificar las operaciones rendidas: ${error.message}`
      );
    }

    for (const item of data || []) {
      const operationId = String(
        item.operation_id ?? ""
      ).trim();

      if (operationId) {
        closedOperationIds.add(operationId);
      }
    }
  }

  return closedOperationIds;
}

async function resolveMentaMerchantIds(
  periods: ShiftTerminalPeriod[],
  periodTo: string,
  merchantId: string
): Promise<Record<string, string[]>> {
  const merchantIdsByTerminal: Record<string, string[]> = {};

  for (const period of periods) {
    const { data: device, error: deviceError } =
      await supabase
        .from("pos_devices")
        .select("id, merchant_id, menta_terminal_id")
        .eq("id", period.posId)
        .eq("merchant_id", merchantId)
        .eq("menta_terminal_id", period.terminalId)
        .maybeSingle();

    if (deviceError || !device) {
      throw new Error(
        `No se pudo validar la asignación de ${period.code}.`
      );
    }

    const { data, error } = await supabase
      .from("pos_menta_merchant_assignments")
      .select(`
        menta_merchant_id,
        valid_from,
        valid_to,
        verification_status
      `)
      .eq("pos_id", period.posId)
      .eq("merchant_id", merchantId)
      .eq("menta_terminal_id", period.terminalId)
      .eq("verification_status", "verified");

    if (error) {
      throw new Error(
        `No se pudieron consultar las asociaciones de ${period.code}: ${error.message}`
      );
    }

    const isTestTerminal =
      process.env.NODE_ENV === "development" &&
      period.posId ===
        "a931213d-f03b-454d-b46b-d2303d51bb83" &&
      merchantId ===
        "a1cfc732-64bc-4a7c-addb-95953499ea68";

    const periodStart = Date.parse(period.periodFrom!);
    const periodEnd = Date.parse(periodTo);

    const validAssignments = (data || []).filter(
      (assignment) => {
        if (!assignment.valid_from) {
          return isTestTerminal && !assignment.valid_to;
        }

        const validFrom = Date.parse(
          assignment.valid_from
        );

        const validTo = assignment.valid_to
          ? Date.parse(assignment.valid_to)
          : Infinity;

        return (
          validFrom <= periodStart &&
          validTo > periodEnd
        );
      }
    );

    const merchantIds = Array.from(
      new Set(
        validAssignments
          .map((assignment) =>
            String(
              assignment.menta_merchant_id ?? ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

    if (merchantIds.length !== 1) {
      throw new Error(
        `La terminal ${period.code} no tiene una asociación MENTA única y verificada para el período solicitado.`
      );
    }

    merchantIdsByTerminal[period.terminalId] =
      merchantIds;
  }

  return merchantIdsByTerminal;
}

export async function preparePosShiftClosure(
  terminals: ShiftTerminal[],
  merchantId: string,
  requestedPeriodTo?: string
) {
  const now = Date.now();

  let periodTo = new Date(now).toISOString();

  if (requestedPeriodTo !== undefined) {
    if (
      !/(Z|[+-]\d{2}:\d{2})$/i.test(
        requestedPeriodTo
      )
    ) {
      throw new Error(
        "La fecha de corte debe incluir zona horaria."
      );
    }

    const cutoffTime = Date.parse(
      requestedPeriodTo
    );

    if (
      !Number.isFinite(cutoffTime) ||
      cutoffTime > now
    ) {
      throw new Error(
        "La fecha y hora de corte no es válida."
      );
    }

    const cutoffEndTime =
        Math.floor(cutoffTime / 1000) * 1000 + 999;

        if (cutoffEndTime > now) {
        throw new Error(
            "El segundo seleccionado todavía no ha finalizado."
        );
        }

        periodTo = new Date(
        cutoffEndTime
        ).toISOString();
  }

  // 1. Determinar el período de cada terminal.

  const periods = await getShiftTerminalPeriods(
  terminals
);
  for (const period of periods) {
    if (!period.periodFrom) {
      throw new Error(
        `La terminal ${period.code} requiere una fecha y hora inicial.`
      );
    }

    const startTime = Date.parse(
      period.periodFrom
    );

    if (
    !Number.isFinite(startTime) ||
    startTime >= Date.parse(periodTo)
    ) {
      throw new Error(
        `El período de la terminal ${period.code} no es válido.`
      );
    }
  }

  // 2. Determinar la fecha inicial más antigua.

  const earliestStart = new Date(
    Math.min(
      ...periods.map((period) =>
        Date.parse(period.periodFrom!)
      )
    )
  ).toISOString();

// 3. Resolver asociaciones y consultar directamente a MENTA.

const merchantIdsByTerminal =
  await resolveMentaMerchantIds(
    periods,
    periodTo,
    merchantId
  );

const merchantGroups = new Map<string, Set<string>>();

for (const period of periods) {
  const merchantIds =
    merchantIdsByTerminal[period.terminalId] || [];

  if (
    merchantIds.length === 0 ||
    merchantIds.some((id) => !id.trim())
  ) {
    throw new Error(
      `No se pudo identificar el comercio MENTA de ${period.code}.`
    );
  }

  for (const merchantId of merchantIds) {
    const normalizedId = merchantId.trim();

    let group = merchantGroups.get(normalizedId);

    if (!group) {
      group = new Set<string>();
      merchantGroups.set(normalizedId, group);
    }

    group.add(period.terminalId);
  }
}

const transactions: Awaited<
  ReturnType<typeof getMentaShiftTransactions>
> = [];

const receivedOperationIds = new Set<string>();

for (const [merchantId, terminalIds] of merchantGroups) {
  const merchantTransactions =
    await getMentaShiftTransactions({
      merchantId,
      terminalIds: Array.from(terminalIds),
      start: earliestStart,
      end: periodTo,
    });

  for (const transaction of merchantTransactions) {
    const operationId = String(
      transaction.operation_id ?? ""
    ).trim();

    if (receivedOperationIds.has(operationId)) {
      throw new Error(
        "MENTA devolvió una operación duplicada entre comercios."
      );
    }

    receivedOperationIds.add(operationId);
    transactions.push(transaction);
  }
}

console.info("[POS SHIFT] Consultas por comercio", {
  merchantCount: merchantGroups.size,
  terminalCount: periods.length,
  operationCount: transactions.length,
});

  // 4. Identificar el período individual
  // de cada terminal.

  const periodsByTerminal = new Map(
    periods.map((period) => [
      period.terminalId,
      period,
    ])
  );

  const periodTransactions =
    transactions.filter((transaction) => {
      const terminalId = String(
        transaction.terminal_id ?? ""
      ).trim();

      const period =
        periodsByTerminal.get(terminalId);

      if (!period?.periodFrom) {
        throw new Error(
          "No se pudo determinar el período de una operación."
        );
      }

      const transactionTime = Date.parse(
        transaction.datetime ?? ""
      );

      const periodStart = Date.parse(
        period.periodFrom
        );

        const periodEnd = Date.parse(
        periodTo
        );

        const isAfterStart =
        period.isFirstClosure
            ? transactionTime >= periodStart
            : transactionTime > periodStart;

        return (
        isAfterStart &&
        transactionTime <= periodEnd
        );
    });

  // 5. Consultar operaciones ya rendidas.

  const closedOperationIds =
    await getAlreadyClosedOperationIds(
      periodTransactions.map(
        (transaction) =>
          String(transaction.operation_id).trim()
      )
    );

  // 6. Excluir operaciones rendidas.

  const pendingTransactions =
    periodTransactions.filter(
      (transaction) =>
        !closedOperationIds.has(
          String(transaction.operation_id).trim()
        )
    );

  // 7. Generar el resumen consolidado.

  const summary = buildPosShiftSummary(
    terminals,
    pendingTransactions
  );

  return {
      source: getPosShiftDataSource(),

    period: {
      from: earliestStart,
      to: periodTo,
    },

    periods,

    summary,

    transactions: pendingTransactions,

    diagnostics: {
      receivedOperations:
        transactions.length,

      operationsInPeriod:
        periodTransactions.length,

      excludedClosedOperations:
        periodTransactions.length -
        pendingTransactions.length,

      pendingOperations:
        pendingTransactions.length,
    },
  };
}


type PreparedShiftClosure = Awaited<
  ReturnType<typeof preparePosShiftClosure>
>;

export async function getRegisteredPosShiftClosure(
  merchantId: string,
  userId: string,
  requestId: string
) {
  const { data, error } = await supabase
    .from("pos_shift_closures")
    .select(`
      id,
      closure_number,
      closed_at
    `)
    .eq("merchant_id", merchantId)
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar el cierre registrado: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return {
    ok: true as const,
    alreadyRegistered: true,
    closureId: String(data.id),
    closureNumber: String(data.closure_number),
    closedAt: data.closed_at,
  };
}

export function getShiftClosureFingerprint(
  prepared: PreparedShiftClosure
): string {
  const operations = prepared.transactions
    .map((transaction) => ({
      operationId: String(
        transaction.operation_id ?? ""
      ).trim(),

      terminalId: String(
        transaction.terminal_id ?? ""
      ).trim(),

      merchantId: String(
        transaction.merchant_id ?? ""
      ).trim(),

      datetime: transaction.datetime ?? null,

      operationType:
        transaction.operation_type ?? null,

      paymentMethod:
        transaction.payment_method ?? null,

      status: transaction.status ?? null,

      grossAmount:
        transaction.gross_amount ?? null,

      currency: transaction.currency ?? null,

      cardBrand:
        transaction.operation_detail?.card
          ?.card_brand ?? null,

      international:
        transaction.operation_detail?.card
          ?.is_international_card === true,

      installments:
        transaction.installments ?? null,

      referenceOperationId:
        transaction.operation_detail
          ?.reference_operation_id ?? null,
    }))
    .sort((a, b) =>
      a.operationId.localeCompare(b.operationId)
    );

  const terminals = prepared.periods
    .map((period) => ({
      posId: period.posId,
      terminalId: period.terminalId,
      periodFrom: period.periodFrom,
      previousClosureTerminalId:
        period.previousClosureTerminalId,
    }))
    .sort((a, b) =>
      a.posId.localeCompare(b.posId)
    );

  const payload = JSON.stringify({
    version: 1,
    terminals,
    operations,
  });

  return createHash("sha256")
    .update(payload, "utf8")
    .digest("hex");
}

type RegisterShiftClosureOptions = {
  merchantId: string;
  userId: string;
  requestedPosId: string | null;
  requestId: string;
  prepared: PreparedShiftClosure;
  confirmPendingRequest?: boolean;
};

export async function registerPosShiftClosure({
  merchantId,
  userId,
  requestedPosId,
  requestId,
  prepared,
  confirmPendingRequest = false,
}: RegisterShiftClosureOptions) {

  if (
    !merchantId ||
    !userId ||
    !requestId
  ) {
    throw new Error(
      "Faltan datos para registrar el cierre."
    );
  }

  if (
    requestedPosId &&
    !prepared.periods.some(
      (period) =>
        period.posId === requestedPosId
    )
  ) {
    throw new Error(
      "La terminal solicitante no pertenece al cierre."
    );
  }

  const terminals = prepared.periods.map(
    (period) => {

      if (!period.periodFrom) {
        throw new Error(
          `La terminal ${period.code} no tiene fecha inicial.`
        );
      }

      const terminalSummary =
        prepared.summary.terminals.find(
          (terminal) =>
            terminal.posId === period.posId
        );

      if (!terminalSummary) {
        throw new Error(
          `No se encontró el resumen de ${period.code}.`
        );
      }

      const operations = prepared.transactions
        .filter(
          (transaction) =>
            String(
              transaction.terminal_id ?? ""
            ).trim() === period.terminalId
        )
        .map((transaction) => ({
          operation_id:
            String(transaction.operation_id ?? "").trim(),

          transaction_id:
            transaction.transaction_id ?? null,

          operation_number:
            transaction.operation_number ?? null,

          terminal_id:
            transaction.terminal_id ?? null,

          datetime:
            transaction.datetime ?? null,

          operation_type:
            transaction.operation_type ?? null,

          payment_method:
            transaction.payment_method ?? null,

          gross_amount:
            transaction.gross_amount ?? null,

          currency:
            transaction.currency ?? null,

          status:
            transaction.status ?? null,

          card_brand:
            transaction.operation_detail?.card
              ?.card_brand ?? null,

          is_international_card:
            transaction.operation_detail?.card
              ?.is_international_card === true,

          installments:
            transaction.installments ?? null,

          reference_operation_id:
            transaction.operation_detail
              ?.reference_operation_id ?? null,

          reference_operation_number:
            transaction.operation_detail
              ?.reference_operation_number ?? null,
        }));

      if (
        operations.length !==
        terminalSummary.operationCount
      ) {
        throw new Error(
          `La cantidad de operaciones de ${period.code} no coincide.`
        );
      }

      return {
        posId: period.posId,
        periodFrom: period.periodFrom,

        previousClosureTerminalId:
          period.previousClosureTerminalId,

        summary: terminalSummary,

        operations,
      };
    }
  );

  const totalOperations = terminals.reduce(
    (sum, terminal) =>
      sum + terminal.operations.length,
    0
  );

  if (totalOperations === 0) {
    throw new Error(
        "No existen operaciones pendientes para realizar el cierre de turno."
    );
    }

  if (
    totalOperations !==
    prepared.summary.totals.operationCount
  ) {
    throw new Error(
      "La cantidad consolidada de operaciones no coincide."
    );
  }

  const summaryPayload = {
  ...prepared.summary,
  source: prepared.source,
  period: prepared.period,
  periods: prepared.periods,
  diagnostics: prepared.diagnostics,
};

const { data, error } = confirmPendingRequest
  ? await supabase.rpc(
      "confirm_pos_shift_closure_request",
      {
        p_request_id: requestId,

        p_merchant_id: merchantId,

        p_user_id: userId,

        p_fingerprint:
          getShiftClosureFingerprint(prepared),

        p_summary: summaryPayload,

        p_terminals: terminals,
      }
    )
  : await supabase.rpc(
      "register_pos_shift_closure",
      {
        p_merchant_id: merchantId,

        p_user_id: userId,

        p_requested_pos_id: requestedPosId,

        p_request_id: requestId,

        p_period_to: prepared.period.to,

        p_summary: summaryPayload,

        p_terminals: terminals,
      }
    );

  if (error) {
  const conflictCodes: Record<string, string> = {
    "La solicitud de cierre fue cancelada.":
      "REQUEST_CANCELLED",

    "El resumen cambió. Debe confirmarlo nuevamente.":
      "CONFIRMATION_REQUIRED",

    "La fecha de corte fue modificada.":
      "REQUEST_CHANGED",

    "Las terminales seleccionadas fueron modificadas.":
      "REQUEST_CHANGED",

    "Las terminales del cierre no coinciden.":
      "REQUEST_CHANGED",

    "El período inicial fue modificado.":
      "REQUEST_CHANGED",

    "Existe un cierre posterior. Genere una nueva solicitud.":
      "SHIFT_ALREADY_CLOSED",

    "Existe un cierre posterior. Actualice el resumen.":
      "SHIFT_ALREADY_CLOSED",

    "La fecha inicial no coincide con la habilitación administrativa de la terminal.":
      "SHIFT_CONFIGURATION_CHANGED",

    "La fecha inicial no coincide con el cierre anterior.":
      "SHIFT_ALREADY_CLOSED",

    "La fecha final debe ser posterior al cierre anterior.":
      "SHIFT_ALREADY_CLOSED",

    "No existen operaciones pendientes para realizar el cierre de turno.":
      "NO_OPERATIONS",
  };

  const conflictCode =
    error.code === "P0001"
      ? conflictCodes[error.message.trim()]
      : undefined;

  if (conflictCode) {
    throw Object.assign(
      new Error(error.message),
      {
        name: "ShiftClosureConflictError",
        code: conflictCode,
        status: 409,
      }
    );
  }

  throw new Error(
    `No se pudo registrar el cierre: ${error.message}`
  );
}

  if (
    !data ||
    data.ok !== true ||
    !data.closureId
  ) {
    throw new Error(
      "Supabase no confirmó el registro del cierre."
    );
  }

  return {
    ok: true as const,

    alreadyRegistered:
      data.alreadyRegistered === true,

    closureId:
      String(data.closureId),

    closureNumber:
      String(data.closureNumber),

    closedAt:
      data.closedAt ?? null,
  };
}

