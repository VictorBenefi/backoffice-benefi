import { NextResponse } from "next/server";

import {
  getPosAccess,
  getAuthorizedPosTerminals,
  PosAccessError,
} from "@/lib/pos/get-pos-access";

import {
  createShiftClosureRequest,
} from "@/lib/pos/shift-closure-requests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const timePattern =
  /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

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

    // 2. Recuperar datos de la solicitud.

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

    const requestedPosId =
      typeof body.requestedPosId === "string"
        ? body.requestedPosId.trim().toLowerCase()
        : "";

    const requestedTime =
      typeof body.requestedTime === "string"
        ? body.requestedTime.trim()
        : "";

    const rawPosIds = body.posIds;

    // 3. Validar datos recibidos.

    if (!uuidPattern.test(merchantId)) {
      return errorResponse(
        "INVALID_MERCHANT_ID",
        "El comercio indicado no es válido.",
        400
      );
    }

    if (!uuidPattern.test(requestedPosId)) {
      return errorResponse(
        "INVALID_REQUESTED_POS",
        "La terminal solicitante no es válida.",
        400
      );
    }

    if (!timePattern.test(requestedTime)) {
      return errorResponse(
        "INVALID_CUTOFF_TIME",
        "La hora debe tener formato HH:mm:ss.",
        400
      );
    }

    if (
      !Array.isArray(rawPosIds) ||
      rawPosIds.length === 0 ||
      !rawPosIds.every(
        (id: unknown) =>
          typeof id === "string" &&
          uuidPattern.test(id.trim())
      )
    ) {
      return errorResponse(
        "INVALID_TERMINALS",
        "Debe seleccionar terminales válidas.",
        400
      );
    }

    const posIds: string[] = Array.from(
      new Set<string>(
        rawPosIds.map(
          (id: string) =>
            id.trim().toLowerCase()
        )
      )
    );

    // 4. Validar terminales autorizadas.

    const authorizedTerminals =
      await getAuthorizedPosTerminals(
        access,
        merchantId
      );

    const authorizedIds = new Set(
      authorizedTerminals.map(
        (terminal) => terminal.posId
      )
    );

    if (!authorizedIds.has(requestedPosId)) {
      return errorResponse(
        "REQUESTED_POS_FORBIDDEN",
        "La terminal solicitante no está habilitada.",
        403
      );
    }

    if (
      posIds.some(
        (posId) => !authorizedIds.has(posId)
      )
    ) {
      return errorResponse(
        "TERMINAL_FORBIDDEN",
        "Una o más terminales no están habilitadas.",
        403
      );
    }

    if (!posIds.includes(requestedPosId)) {
      return errorResponse(
        "REQUESTED_POS_NOT_SELECTED",
        "La terminal solicitante debe formar parte del cierre.",
        400
      );
    }

    // 5. Construir selección validada.

    const terminals = authorizedTerminals
      .filter(
        (terminal) =>
          posIds.includes(terminal.posId)
      )
      .map((terminal) => ({
        posId: terminal.posId,
        code: terminal.code,
        terminalId: terminal.terminalId,
      }));

    // 6. Preparar y guardar solicitud pendiente.

    const result = await createShiftClosureRequest({
      merchantId,
      userId: access.user.id,
      requestedPosId,
      terminals,
      requestedTime,
    });

    // 7. Devolver resumen a la APK.

    return NextResponse.json(
      result,
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {

    if (error instanceof PosAccessError) {
      return errorResponse(
        error.code,
        error.message,
        error.status
      );
    }

    console.error(
      "[POS SHIFT PREVIEW]",
      error
    );

    return errorResponse(
      "SHIFT_PREVIEW_ERROR",
      "No se pudo preparar el resumen de cierre.",
      500
    );
  }
}