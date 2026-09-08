import { NextRequest, NextResponse } from "next/server";
import { mentaRequest } from "@/lib/menta/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = searchParams.get("page") || "0";
    const size = searchParams.get("size") || "100";

    const merchantId = searchParams.get("merchantId");
    const terminalId = searchParams.get("terminalId");
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const status = searchParams.get("status");

    const params = new URLSearchParams({
      page,
      size,
    });

    if (merchantId) {
      params.set("merchantId", merchantId);
    }

    if (terminalId) {
      params.set("terminalId", terminalId);
    }

    if (start) {
      params.set("start", start);
    }

    if (end) {
      params.set("end", end);
    }

    if (status) {
      params.set("status", status);
    }

    const data = await mentaRequest(
      `/v2/transaction-reports?${params.toString()}`
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Error consultando transacciones MENTA:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar las transacciones de MENTA.",
      },
      { status: 500 }
    );
  }
}