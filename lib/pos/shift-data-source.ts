import "server-only";

export type PosShiftDataSource =
  | "MENTA_DIRECT"
  | "SIMULATED";

const INTEGRATION_SUPABASE_URL =
  "https://opwweoyxwdolwpzqwgan.supabase.co";

export function getPosShiftDataSource(): PosShiftDataSource {
  const source =
    process.env.POS_SHIFT_DATA_SOURCE?.trim() ||
    "MENTA_DIRECT";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
      .replace(/\/+$/, "");

  const isIntegrationDatabase =
    supabaseUrl === INTEGRATION_SUPABASE_URL;

  if (source === "SIMULATED") {
        if (
      process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_TARGET_ENV !== "integration-pos" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "integration/pos-shift-closures" ||
      !isIntegrationDatabase
    ) {
      throw new Error(
        "El modo simulado POS no está autorizado en este ambiente."
      );
    }

    return "SIMULATED";
  }

  if (source !== "MENTA_DIRECT") {
    throw new Error(
      "La fuente de operaciones POS no es válida."
    );
  }

  if (isIntegrationDatabase) {
    throw new Error(
      "El ambiente de integración no puede consultar MENTA."
    );
  }

  return "MENTA_DIRECT";
}