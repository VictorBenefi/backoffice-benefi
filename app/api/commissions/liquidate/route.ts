import { NextResponse } from "next/server";
import { liquidateMonth } from "@/lib/commissions/liquidate-month";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Parámetros inválidos. Debe enviar year y month." },
        { status: 400 }
      );
    }

    const result = await liquidateMonth({ year, month });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Error al liquidar comisiones" },
      { status: 500 }
    );
  }
}