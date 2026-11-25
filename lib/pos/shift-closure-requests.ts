import "server-only";

import { createClient } from "@supabase/supabase-js";
import type {
  ShiftTerminal,
} from "@/lib/pos-shift-summary";

import {
  preparePosShiftClosure,
  getShiftClosureFingerprint,
  registerPosShiftClosure,
  getRegisteredPosShiftClosure,
} from "@/lib/pos/shift-closure";

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

export function resolveShiftCutoff(
  requestedTime: string
): string {
  const time = requestedTime.trim();

  if (
    !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)
  ) {
    throw new Error(
      "La hora de corte debe tener formato HH:mm:ss."
    );
  }

  const now = Date.now();

  const argentinaOffset = 3 * 60 * 60 * 1000;

  const localNow = new Date(
    now - argentinaOffset
  );

  const localDate = localNow
    .toISOString()
    .slice(0, 10);

  let cutoffTime = Date.parse(
    `${localDate}T${time}.999-03:00`
  );

  if (cutoffTime > now) {
    cutoffTime -= 24 * 60 * 60 * 1000;
  }

  return new Date(
    cutoffTime
  ).toISOString();
}
type CreateShiftClosureRequestOptions = {
  merchantId: string;
  userId: string;
  requestedPosId: string | null;
  terminals: ShiftTerminal[];
  requestedTime: string;
  };

export async function createShiftClosureRequest({
  merchantId,
  userId,
  requestedPosId,
  terminals,
  requestedTime,
  }: CreateShiftClosureRequestOptions) {

  if (!merchantId || !userId) {
    throw new Error(
      "Faltan datos del comercio o usuario."
    );
  }

  if (terminals.length === 0) {
    throw new Error(
      "No se seleccionaron terminales."
    );
  }

  if (
    requestedPosId &&
    !terminals.some(
      (terminal) =>
        terminal.posId === requestedPosId
    )
  ) {
    throw new Error(
      "La terminal solicitante no pertenece al cierre."
    );
  }

  const periodTo = resolveShiftCutoff(
    requestedTime
  );

  const prepared = await preparePosShiftClosure(
  terminals,
  merchantId,
  periodTo
);

  const fingerprint =
    getShiftClosureFingerprint(prepared);

  const { data, error } = await supabase
    .from("pos_shift_closure_requests")
    .insert({
      merchant_id: merchantId,

      user_id: userId,

      requested_pos_id: requestedPosId,

      period_to: prepared.period.to,

      terminals: prepared.periods,

      summary: {
        ...prepared.summary,
        source: prepared.source,
        period: prepared.period,
        diagnostics: prepared.diagnostics,
      },

      fingerprint,

      status: "PENDING",
    })
    .select(`
      id,
      period_to,
      status,
      created_at
    `)
    .single();

  if (error || !data) {
    throw new Error(
      `No se pudo guardar la solicitud de cierre: ${
        error?.message ?? "Respuesta inválida."
      }`
    );
  }

  return {
    ok: true as const,

    requestId: data.id,

    status: data.status,

    createdAt: data.created_at,

    fingerprint,

    source: prepared.source,

    period: prepared.period,

    periods: prepared.periods,

    summary: prepared.summary,

    diagnostics: prepared.diagnostics,
  };
}
type GetShiftClosureRequestOptions = {
  requestId: string;
  merchantId: string;
  userId: string;
};

export async function getShiftClosureRequest({
  requestId,
  merchantId,
  userId,
}: GetShiftClosureRequestOptions) {

  if (!requestId || !merchantId || !userId) {
    throw new Error(
      "Faltan datos para consultar la solicitud."
    );
  }

  const { data, error } = await supabase
    .from("pos_shift_closure_requests")
    .select(`
      id,
      merchant_id,
      user_id,
      requested_pos_id,
      period_to,
      terminals,
      summary,
      fingerprint,
      status,
      created_at,
      updated_at,
      confirmed_at,
      cancelled_at,
      closure_id
    `)
    .eq("id", requestId)
    .eq("merchant_id", merchantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la solicitud: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return data;
}
type ConfirmShiftClosureRequestOptions = {
  requestId: string;
  merchantId: string;
  userId: string;
  fingerprint: string;
};

export async function confirmShiftClosureRequest({
  requestId,
  merchantId,
  userId,
  fingerprint,
}: ConfirmShiftClosureRequestOptions) {

  const request = await getShiftClosureRequest({
    requestId,
    merchantId,
    userId,
  });

  if (!request) {
    return {
      ok: false as const,
      code: "REQUEST_NOT_FOUND",
      error: "Solicitud de cierre no encontrada.",
    };
  }

  if (request.status === "CANCELLED") {
    return {
      ok: false as const,
      code: "REQUEST_CANCELLED",
      error: "La solicitud de cierre fue cancelada.",
    };
  }

  if (request.status === "CONFIRMED") {
    const registered =
      await getRegisteredPosShiftClosure(
        merchantId,
        userId,
        requestId
      );

    if (!registered) {
      throw new Error(
        "No se encontró el cierre confirmado."
      );
    }

    return {
      ...registered,
      requestId,
      status: "CONFIRMED",
    };
  }

  if (request.status !== "PENDING") {
    throw new Error(
      "Estado de solicitud inválido."
    );
  }

  if (fingerprint !== request.fingerprint) {
    return {
      ok: false as const,
      code: "CONFIRMATION_REQUIRED",
      error: "Debe confirmar el resumen vigente.",
    };
  }

  const savedPeriods = request.terminals as {
    posId: string;
    code: string;
    terminalId: string;
    periodFrom: string;
    isFirstClosure: boolean;
    previousClosureTerminalId: string | null;
  }[];

  const terminals: ShiftTerminal[] =
    savedPeriods.map((period) => ({
      posId: period.posId,
      code: period.code,
      terminalId: period.terminalId,
    }));

  const prepared = await preparePosShiftClosure(
    terminals,
    merchantId,
    request.period_to
  );

  const periodsChanged = savedPeriods.some(
    (savedPeriod) => {
      const currentPeriod =
        prepared.periods.find(
          (period) =>
            period.posId === savedPeriod.posId
        );

      return (
        !currentPeriod ||
        currentPeriod.previousClosureTerminalId !==
          savedPeriod.previousClosureTerminalId ||
        Date.parse(currentPeriod.periodFrom ?? "") !==
          Date.parse(savedPeriod.periodFrom)
      );
    }
  );

  if (periodsChanged) {
    return {
      ok: false as const,
      code: "SHIFT_ALREADY_CLOSED",
      error:
        "El período del turno cambió. Genere una nueva solicitud.",
    };
  }

  const currentFingerprint =
    getShiftClosureFingerprint(prepared);

  if (currentFingerprint !== request.fingerprint) {

  const { data: updatedRequest, error: updateError } =
    await supabase
      .from("pos_shift_closure_requests")
      .update({
        summary: {
          ...prepared.summary,
          source: prepared.source,
          period: prepared.period,
          diagnostics: prepared.diagnostics,
        },

        fingerprint: currentFingerprint,

        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("merchant_id", merchantId)
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .eq("fingerprint", request.fingerprint)
      .eq("updated_at", request.updated_at)
      .select("id")
      .maybeSingle();

  if (updateError) {
    throw new Error(
      `No se pudo actualizar el resumen: ${updateError.message}`
    );
  }

  if (!updatedRequest) {
    return {
      ok: false as const,
      code: "REQUEST_CHANGED",
      error:
        "La solicitud fue modificada. Consulte nuevamente su estado.",
    };
  }

  return {
    ok: false as const,
    code: "SHIFT_CHANGED",
    error:
      "Las operaciones cambiaron. Debe revisar nuevamente el resumen.",
    requestId,
    fingerprint: currentFingerprint,
    period: prepared.period,
    periods: prepared.periods,
    summary: prepared.summary,
    diagnostics: prepared.diagnostics,
  };
}

  if (prepared.summary.totals.operationCount === 0) {
    return {
      ok: false as const,
      code: "NO_OPERATIONS",
      error:
        "No existen operaciones pendientes para realizar el cierre de turno.",
    };
  }

  const registered = await registerPosShiftClosure({
    merchantId,
    userId,
    requestedPosId: request.requested_pos_id,
    requestId,
    prepared,
    confirmPendingRequest: true,
  });

  return {
    ...registered,
    requestId,
    status: "CONFIRMED",
  };
}
type CancelShiftClosureRequestOptions = {
  requestId: string;
  merchantId: string;
  userId: string;
};

export async function cancelShiftClosureRequest({
  requestId,
  merchantId,
  userId,
}: CancelShiftClosureRequestOptions) {

  const request = await getShiftClosureRequest({
    requestId,
    merchantId,
    userId,
  });

  if (!request) {
    return {
      ok: false as const,
      code: "REQUEST_NOT_FOUND",
      error: "Solicitud de cierre no encontrada.",
    };
  }

  if (request.status === "CONFIRMED") {
    return {
      ok: false as const,
      code: "REQUEST_ALREADY_CONFIRMED",
      error:
        "La solicitud ya fue confirmada y no puede cancelarse.",
    };
  }

  if (request.status === "CANCELLED") {
    return {
      ok: true as const,
      requestId,
      status: "CANCELLED",
      alreadyCancelled: true,
      cancelledAt: request.cancelled_at,
    };
  }

  const cancelledAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("pos_shift_closure_requests")
    .update({
      status: "CANCELLED",
      cancelled_at: cancelledAt,
      updated_at: cancelledAt,
    })
    .eq("id", requestId)
    .eq("merchant_id", merchantId)
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .select("id, status, cancelled_at")
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo cancelar la solicitud: ${error.message}`
    );
  }

  if (!data) {
    return {
      ok: false as const,
      code: "REQUEST_CHANGED",
      error:
        "La solicitud cambió de estado. Consulte nuevamente.",
    };
  }

  return {
    ok: true as const,
    requestId: data.id,
    status: data.status,
    alreadyCancelled: false,
    cancelledAt: data.cancelled_at,
  };
}