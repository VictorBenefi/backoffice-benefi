import { NextResponse } from "next/server";
import { mentaRequest } from "@/lib/menta/client";
import { createClient } from "@supabase/supabase-js";

type MentaTerminal = {
  id: string;
  merchant_id: string | null;
  customer_id: string | null;
  serial_code: string | null;
  hardware_version: string | null;
  trade_mark: string | null;
  model: string | null;
  status: string | null;
};

type MentaTerminalResponse = {
  _embedded?: {
    terminals?: MentaTerminal[];
  };
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeSerial(value?: string | null) {
  return (value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export async function GET() {
  try {
    const mentaData =
      await mentaRequest<MentaTerminalResponse>(
        "/v1/terminals?page=0&size=10000"
      );

    const mentaTerminals =
      mentaData._embedded?.terminals || [];

    const { data: posDevices, error } =
      await supabase
        .from("pos_devices")
        .select(`
          id,
          code,
          serial,
          merchant_id,
          merchant_branch_id,
          menta_terminal_id
        `)
        .order("code");

    if (error) {
      throw new Error(
        `No se pudieron cargar los POS de BENEFÍ: ${error.message}`
      );
    }

    const results = (posDevices || []).map((pos) => {
      const localSerial = normalizeSerial(
        pos.serial
      );

      const matchedTerminal =
        mentaTerminals.find(
          (terminal) =>
            normalizeSerial(terminal.serial_code) ===
            localSerial
        ) || null;

      return {
        pos_id: pos.id,
        pos_code: pos.code,
        serial_benefi: pos.serial,
        merchant_id_benefi: pos.merchant_id,
        merchant_branch_id_benefi:
          pos.merchant_branch_id,
        menta_terminal_id_actual:
          pos.menta_terminal_id,
        match: Boolean(matchedTerminal),
        menta_terminal: matchedTerminal
          ? {
              id: matchedTerminal.id,
              merchant_id:
                matchedTerminal.merchant_id,
              serial_code:
                matchedTerminal.serial_code,
              model: matchedTerminal.model,
              trade_mark:
                matchedTerminal.trade_mark,
              status: matchedTerminal.status,
            }
          : null,
      };
    });

    const matched = results.filter(
      (item) => item.match
    ).length;

    const unmatched = results.length - matched;

    return NextResponse.json({
      summary: {
        total_pos_benefi: results.length,
        total_terminals_menta:
          mentaTerminals.length,
        matched,
        unmatched,
      },
      results,
    });
  } catch (error) {
    console.error(
      "Error preparando sincronización MENTA:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo preparar la sincronización.",
      },
      { status: 500 }
    );
  }
}