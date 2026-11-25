import { NextResponse } from "next/server";

import {
  getPosAccess,
  PosAccessError,
} from "@/lib/pos/get-pos-access";

import {
  cancelShiftClosureRequest,
} from "@/lib/pos/shift-closure-requests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const requestId =
      typeof body.requestId === "string"
        ? body.requestId.trim().toLowerCase()
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

    // 4. Verificar permisos sobre el comercio.

    if (
      !access.fullMerchantIds.includes(merchantId)
    ) {
      return errorResponse(
        "MERCHANT_FORBIDDEN",
        "No tiene acceso al comercio solicitado.",
        403
      );
    }

    // 5. Cancelar solicitud del usuario.

    const result =
      await cancelShiftClosureRequest({
        requestId,
        merchantId,
        userId: access.user.id,
      });

    // 6. Determinar respuesta HTTP.

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

    if (error instanceof PosAccessError) {
      return errorResponse(
        error.code,
        error.message,
        error.status
      );
    }

    console.error(
      "[POS SHIFT CANCEL]",
      error
    );

    return errorResponse(
      "SHIFT_CANCEL_ERROR",
      "No se pudo cancelar la solicitud de cierre.",
      500
    );
  }
}