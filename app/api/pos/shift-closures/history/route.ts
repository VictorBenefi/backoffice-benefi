import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  getPosAccess,
  PosAccessError,
} from "@/lib/pos/get-pos-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET(request: Request) {
  try {
    // 1. Autenticar usuario.

    const access = await getPosAccess(request);

    const { searchParams } = new URL(request.url);

    // 2. Recuperar parámetros.

    const merchantId =
      searchParams
        .get("merchantId")
        ?.trim()
        .toLowerCase() ?? "";

    const rawPage =
      searchParams.get("page") ?? "1";

    const rawPageSize =
      searchParams.get("pageSize") ?? "20";

    const page = Number(rawPage);
    const pageSize = Number(rawPageSize);

    // 3. Validar parámetros.

    if (!uuidPattern.test(merchantId)) {
      return errorResponse(
        "INVALID_MERCHANT_ID",
        "El comercio indicado no es válido.",
        400
      );
    }

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      return errorResponse(
        "INVALID_PAGINATION",
        "Los parámetros de paginación no son válidos.",
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

    // 5. Calcular paginación.

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 6. Consultar cierres registrados.

    const { data, error, count } = await supabase
      .from("pos_shift_closures")
      .select(
        `
          id,
          closure_number,
          merchant_id,
          requested_pos_id,
          closed_at,
          period_from,
          period_to,
          currency,
          terminal_count,
          operation_count,
          payment_amount,
          annulment_amount,
          refund_amount,
          net_amount
        `,
        { count: "exact" }
      )
      .eq("merchant_id", merchantId)
      .order("closed_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    

    // 8. Construir respuesta para la APK.

    const closures = (data ?? []).map(
      (closure) => {

        const terminalCount =
            Number(closure.terminal_count);

        return {
          closureId: closure.id,

          closureNumber:
            String(closure.closure_number),

          merchantId:
            closure.merchant_id,

          requestedPosId:
            closure.requested_pos_id,

          closedAt:
            closure.closed_at,

            periodFrom:
            closure.period_from,

            periodTo:
            closure.period_to,

            currency:
            closure.currency,

          terminalCount,

          mode:
            terminalCount > 1
              ? "CONSOLIDATED"
              : "INDIVIDUAL",

          operationCount:
            Number(closure.operation_count),

          paymentAmount:
            Number(closure.payment_amount),

          annulmentAmount:
            Number(closure.annulment_amount),

          refundAmount:
            Number(closure.refund_amount),

          netAmount:
            Number(closure.net_amount),
        };
      }
    );

    const total = count ?? 0;

    return NextResponse.json(
      {
        ok: true,
        merchantId,
        page,
        pageSize,
        total,
        totalPages:
          Math.ceil(total / pageSize),
        closures,
      },
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
      "[POS SHIFT HISTORY]",
      error
    );

    return errorResponse(
      "SHIFT_HISTORY_ERROR",
      "No se pudo consultar el historial de cierres.",
      500
    );
  }
}