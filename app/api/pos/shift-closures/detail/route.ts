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

    // 2. Recuperar identificadores.

    const merchantId =
      searchParams
        .get("merchantId")
        ?.trim()
        .toLowerCase() ?? "";

    const closureId =
      searchParams
        .get("closureId")
        ?.trim()
        .toLowerCase() ?? "";

    // 3. Validar identificadores.

    if (!uuidPattern.test(merchantId)) {
      return errorResponse(
        "INVALID_MERCHANT_ID",
        "El comercio indicado no es válido.",
        400
      );
    }

    if (!uuidPattern.test(closureId)) {
      return errorResponse(
        "INVALID_CLOSURE_ID",
        "El identificador del cierre no es válido.",
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

    // 5. Recuperar cierre original.

    const {
      data: closure,
      error: closureError,
    } = await supabase
      .from("pos_shift_closures")
      .select("*")
      .eq("id", closureId)
      .eq("merchant_id", merchantId)
      .maybeSingle();

    if (closureError) {
      throw new Error(closureError.message);
    }

    if (!closure) {
      return errorResponse(
        "CLOSURE_NOT_FOUND",
        "No se encontró el cierre solicitado.",
        404
      );
    }

    // 6. Recuperar nombre del comercio.

    const {
      data: merchant,
      error: merchantError,
    } = await supabase
      .from("merchants")
      .select("id, name")
      .eq("id", merchantId)
      .maybeSingle();

    if (merchantError) {
      throw new Error(merchantError.message);
    }

    // 7. Recuperar terminales del cierre.

    const {
      data: terminalRows,
      error: terminalsError,
    } = await supabase
      .from("pos_shift_closure_terminals")
      .select(`
        id,
        pos_id,
        period_from,
        period_to,
        first_transaction_at,
        last_transaction_at,
        operation_count,
        payment_count,
        annulment_count,
        refund_count,
        rejected_count,
        payment_amount,
        annulment_amount,
        refund_amount,
        net_amount,
        summary
        `)
      .eq("closure_id", closureId)
      .order("id");

    if (terminalsError) {
      throw new Error(terminalsError.message);
    }

    const terminals = terminalRows ?? [];

    if (terminals.length === 0) {
      return errorResponse(
        "INVALID_CLOSURE",
        "El cierre no contiene terminales registradas.",
        409
      );
    }

    // 8. Recuperar operaciones originales.

    const operations: Record<string, unknown>[] = [];

    const batchSize = 500;
    let offset = 0;

    while (true) {

      const {
        data: operationRows,
        error: operationsError,
      } = await supabase
        .from("pos_shift_closure_transactions")
        .select(`
          operation_id,
          menta_transaction_id,
          operation_snapshot
        `)
        .in(
            "closure_terminal_id",
            terminals.map((terminal) => terminal.id)
            )
        .order("operation_id")
        .range(
          offset,
          offset + batchSize - 1
        );

      if (operationsError) {
        throw new Error(operationsError.message);
      }

      const rows = operationRows ?? [];

      for (const row of rows) {

        const snapshot =
          row.operation_snapshot ?? {};

        operations.push({
          operationId: row.operation_id,
          transactionId: row.menta_transaction_id,
          operationNumber: snapshot.operation_number,
          terminalId: snapshot.terminal_id,
          datetime: snapshot.datetime,
          operationType: snapshot.operation_type,
          paymentMethod: snapshot.payment_method,
          grossAmount: snapshot.gross_amount,
          currency: snapshot.currency,
          status: snapshot.status,
          cardBrand: snapshot.card_brand,
          international: snapshot.is_international_card,
          installments: snapshot.installments,
          referenceOperationId:
            snapshot.reference_operation_id,
          referenceOperationNumber:
            snapshot.reference_operation_number,
        });
      }

      if (rows.length < batchSize) {
        break;
      }

      offset += batchSize;
    }

    // 9. Verificar integridad del cierre.

    if (
      operations.length !==
      Number(closure.operation_count)
    ) {
      return errorResponse(
        "CLOSURE_INTEGRITY_ERROR",
        "El detalle no coincide con el cierre registrado.",
        409
      );
    }

    // 10. Ordenar operaciones cronológicamente.

    operations.sort((a, b) => {

      const timeA = Date.parse(
        String(a.datetime ?? "")
      );

      const timeB = Date.parse(
        String(b.datetime ?? "")
      );

      return (
        timeA - timeB ||
        String(a.operationId).localeCompare(
          String(b.operationId)
        )
      );
    });

    // 11. Construir respuesta.

    return NextResponse.json(
      {
        ok: true,

        closureId: closure.id,

        closureNumber:
          String(closure.closure_number),

        merchantId,

        merchantName:
          merchant?.name ?? null,

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

        summary:
        closure.summary,

        terminalCount:
          terminals.length,

        mode:
          terminals.length > 1
            ? "CONSOLIDATED"
            : "INDIVIDUAL",

        totals: {
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
        },

        // Datos persistidos del cierre.
        // Se ajustará su formato público al
        // verificar el esquema definitivo.

        terminals,

        operations,

        reprint: {
          allowed: true,
          label: "REIMPRESIÓN",
        },
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
      "[POS SHIFT DETAIL]",
      error
    );

    return errorResponse(
      "SHIFT_DETAIL_ERROR",
      "No se pudo recuperar el detalle del cierre.",
      500
    );
  }
}