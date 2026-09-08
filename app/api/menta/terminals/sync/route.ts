import { NextResponse } from "next/server";
import { mentaRequest } from "@/lib/menta/client";
import { createClient } from "@supabase/supabase-js";

type MentaTerminal = {
  id: string;
  serial_code: string | null;
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

export async function POST() {
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
        .select("id, code, serial, menta_terminal_id");

    if (error) {
      throw new Error(
        `No se pudieron cargar los POS de BENEFÍ: ${error.message}`
      );
    }

    let updated = 0;
    let unchanged = 0;
    let unmatched = 0;

    const details: Array<{
      pos_id: string;
      pos_code: string | null;
      serial: string | null;
      menta_terminal_id: string | null;
      status: "updated" | "unchanged" | "unmatched";
    }> = [];

    for (const pos of posDevices || []) {
      const localSerial = normalizeSerial(pos.serial);

      const matchedTerminal =
        mentaTerminals.find(
          (terminal) =>
            normalizeSerial(terminal.serial_code) ===
            localSerial
        ) || null;

      if (!matchedTerminal) {
        unmatched++;

        details.push({
          pos_id: pos.id,
          pos_code: pos.code,
          serial: pos.serial,
          menta_terminal_id: pos.menta_terminal_id,
          status: "unmatched",
        });

        continue;
      }

      if (
        pos.menta_terminal_id === matchedTerminal.id
      ) {
        unchanged++;

        details.push({
          pos_id: pos.id,
          pos_code: pos.code,
          serial: pos.serial,
          menta_terminal_id: matchedTerminal.id,
          status: "unchanged",
        });

        continue;
      }

      const { error: updateError } =
        await supabase
          .from("pos_devices")
          .update({
            menta_terminal_id: matchedTerminal.id,
          })
          .eq("id", pos.id);

      if (updateError) {
        throw new Error(
          `No se pudo actualizar el POS ${pos.code || pos.id}: ${updateError.message}`
        );
      }

      updated++;

      details.push({
        pos_id: pos.id,
        pos_code: pos.code,
        serial: pos.serial,
        menta_terminal_id: matchedTerminal.id,
        status: "updated",
      });
    }

    return NextResponse.json({
      ok: true,
      summary: {
        total_pos_benefi: (posDevices || []).length,
        total_terminals_menta: mentaTerminals.length,
        updated,
        unchanged,
        unmatched,
      },
      details,
    });
  } catch (error) {
    console.error(
      "Error sincronizando terminales MENTA:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron sincronizar las terminales de MENTA.",
      },
      { status: 500 }
    );
  }
}