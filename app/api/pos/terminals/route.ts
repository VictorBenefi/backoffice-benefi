import { NextResponse } from "next/server";

import {
  getPosAccess,
  getAuthorizedPosTerminals,
  PosAccessError,
} from "@/lib/pos/get-pos-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const access = await getPosAccess(request);

    const { searchParams } = new URL(request.url);

    const merchantId =
      searchParams.get("merchantId")?.trim() ?? "";

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(merchantId)) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_MERCHANT_ID",
          message:
            "Debe indicar un identificador de comercio válido.",
        },
        { status: 400 }
      );
    }

    const terminals =
      await getAuthorizedPosTerminals(
        access,
        merchantId
      );

    return NextResponse.json(
      {
        ok: true,
        merchantId,
        terminalCount: terminals.length,
        terminals,
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
      return NextResponse.json(
        {
          ok: false,
          code: error.code,
          message: error.message,
        },
        { status: error.status }
      );
    }

    console.error(
      "[POS TERMINALS]",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message:
          "No se pudieron consultar las terminales.",
      },
      { status: 500 }
    );
  }
}