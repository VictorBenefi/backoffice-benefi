import { NextResponse } from "next/server";

import {
  getPosAccess,
  getAuthorizedPosTerminals,
  PosAccessError,
} from "@/lib/pos/get-pos-access";

import {
  getShiftClosureRequest,
  confirmShiftClosureRequest,
} from "@/lib/pos/shift-closure-requests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fingerprintPattern =
  /^[0-9a-f]{64}$/;

function errorResponse(
  code: string,
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    // 1. Autenticar usuario.

    const access = await getPosAccess(request);

    // 2. Recuperar datos recibidos.

    const body = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return errorResponse(
        "INVALID_BODY",
        "La solicitud no es válida.",
        400
      );
    }

    const merchantId =
      typeof body.merchantId === "string"
        ? body.merchantId.trim().toLowerCase()
        : "";

    const requestId =
      typeof body.requestId === "string"
        ? body.requestId.trim().toLowerCase()
        : "";

    const fingerprint =
      typeof body.fingerprint === "string"
        ? body.fingerprint.trim()
        : "";

    // 3. Validar identificadores.

    if (!uuidPattern.test(merchantId)) {
      return errorResponse(
        "INVALID_MERCHANT_ID",
        "El comercio indicado no es válido.",
        400
      );
    }

    if (!uuidPattern.test(requestId)) {
      return errorResponse(
        "INVALID_REQUEST_ID",
        "La solicitud de cierre no es válida.",
        400
      );
    }

    if (!fingerprintPattern.test(fingerprint)) {
      return errorResponse(
        "INVALID_FINGERPRINT",
        "La identificación del resumen no es válida.",
        400
      );
    }

    // 4. Recuperar solicitud del usuario.

    const savedRequest =
      await getShiftClosureRequest({
        requestId,
        merchantId,
        userId: access.user.id,
      });

    if (!savedRequest) {
      return errorResponse(
        "REQUEST_NOT_FOUND",
        "No se encontró la solicitud de cierre.",
        404
      );
    }

    // 5. Verificar acceso actual al comercio.

    if (
      !access.fullMerchantIds.includes(merchantId)
    ) {
      return errorResponse(
        "MERCHANT_FORBIDDEN",
        "No tiene acceso al comercio solicitado.",
        403
      );
    }

        if (
      access.authenticatedPosId &&
      access.authenticatedPosId !==
        savedRequest.requested_pos_id
    ) {
      return errorResponse(
        "POS_IDENTITY_MISMATCH",
        "La solicitud pertenece a otra terminal.",
        403
      );
    }

    // 6. Revalidar terminales de solicitudes pendientes.

    if (savedRequest.status === "PENDING") {

      const authorizedTerminals =
        await getAuthorizedPosTerminals(
          access,
          merchantId
        );

      const authorizedById = new Map(
        authorizedTerminals.map(
          (terminal) => [
            terminal.posId,
            terminal,
          ]
        )
      );

      const savedTerminals =
        savedRequest.terminals;

      if (
        !Array.isArray(savedTerminals) ||
        savedTerminals.length === 0
      ) {
        return errorResponse(
          "INVALID_SAVED_TERMINALS",
          "La solicitud no contiene terminales válidas.",
          409
        );
      }

      for (const terminal of savedTerminals) {

        if (
          !terminal ||
          typeof terminal.posId !== "string" ||
          typeof terminal.terminalId !== "string"
        ) {
          return errorResponse(
            "INVALID_SAVED_TERMINALS",
            "La solicitud contiene terminales inconsistentes.",
            409
          );
        }

        const authorized =
          authorizedById.get(terminal.posId);

        if (
          !authorized ||
          authorized.terminalId !==
            terminal.terminalId
        ) {
          return errorResponse(
            "TERMINAL_FORBIDDEN",
            "Una o más terminales ya no están habilitadas.",
            403
          );
        }
      }

      if (
        !savedRequest.requested_pos_id ||
        !authorizedById.has(
          savedRequest.requested_pos_id
        ) ||
        !savedTerminals.some(
          (terminal) =>
            terminal.posId ===
            savedRequest.requested_pos_id
        )
      ) {
        return errorResponse(
          "REQUESTED_POS_FORBIDDEN",
          "La terminal solicitante ya no está habilitada.",
          403
        );
      }
    }

    // 7. Confirmar utilizando el motor existente.

    const result =
      await confirmShiftClosureRequest({
        requestId,
        merchantId,
        userId: access.user.id,
        fingerprint,
      });

    // 8. Determinar respuesta HTTP.

    let status = 200;

    if (!result.ok) {
      status =
        result.code === "REQUEST_NOT_FOUND"
          ? 404
          : 409;
    }

    return NextResponse.json(
      result,
      {
        status,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {

  if (
    error instanceof Error &&
    error.name === "ShiftClosureConflictError" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return errorResponse(
      error.code,
      error.message,
      409
    );
  }

  if (error instanceof PosAccessError) {
      return errorResponse(
        error.code,
        error.message,
        error.status
      );
    }

    console.error(
      "[POS SHIFT CONFIRM]",
      error
    );

    return errorResponse(
      "SHIFT_CONFIRM_ERROR",
      "No se pudo confirmar el cierre de turno.",
      500
    );
  }
}