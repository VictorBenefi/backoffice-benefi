import { NextResponse } from "next/server";
import { mentaRequest } from "@/lib/menta/client";

export async function GET() {
  try {
    const data = await mentaRequest(
      "/v1/terminals?page=0&size=1000"
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Error consultando terminales MENTA:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron consultar las terminales de MENTA.",
      },
      { status: 500 }
    );
  }
}