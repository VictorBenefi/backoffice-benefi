import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const supabase = createAdminClient();

    const { data: existingRows, error: existingError } = await supabase
      .from("vendor_commissions")
      .select("id, status")
      .eq("year", year)
      .eq("month", month);

    if (existingError) {
      return NextResponse.json(
        { error: `Error buscando liquidaciones del período: ${existingError.message}` },
        { status: 500 }
      );
    }

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json(
        { error: "No hay liquidaciones guardadas para ese período." },
        { status: 400 }
      );
    }

    const alreadyClosed = existingRows.every((row) => row.status === "closed");

    if (alreadyClosed) {
      return NextResponse.json({
        ok: true,
        message: "La liquidación ya estaba cerrada.",
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("vendor_commissions")
      .update({
        status: "closed",
        closed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("year", year)
      .eq("month", month);

    if (updateError) {
      return NextResponse.json(
        { error: `Error cerrando liquidación: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Liquidación cerrada correctamente.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al cerrar liquidación" },
      { status: 500 }
    );
  }
}