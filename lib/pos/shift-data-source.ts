import "server-only";

export type PosShiftDataSource =
  | "MENTA_DIRECT"
  | "MENTA_TEST"
  | "SIMULATED";

const INTEGRATION_SUPABASE_URL =
  "https://opwweoyxwdolwpzqwgan.supabase.co";

export const MENTA_TEST_MERCHANT_ID =
  "89f03c63-106e-44ca-b2cc-630f6cf8d56f";

export const MENTA_TEST_TERMINAL_ID =
  "2f7be4d2-a2e1-439b-a326-d25f3551b0bd";

export function isPosIntegrationEnvironment(): boolean {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
      .replace(/\/+$/, "");

  return (
    process.env.POS_INTEGRATION_ONLY === "true" ||
    process.env.VERCEL_TARGET_ENV === "integration-pos" ||
    process.env.VERCEL_GIT_COMMIT_REF ===
      "integration/pos-shift-closures" ||
    supabaseUrl === INTEGRATION_SUPABASE_URL
  );
}

export function getPosShiftDataSource(): PosShiftDataSource {
  const source =
    process.env.POS_SHIFT_DATA_SOURCE?.trim() ||
    "MENTA_DIRECT";

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.trim()
      .replace(/\/+$/, "");

  const isAuthorizedIntegration =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_TARGET_ENV === "integration-pos" &&
    process.env.VERCEL_GIT_COMMIT_REF ===
      "integration/pos-shift-closures" &&
    supabaseUrl === INTEGRATION_SUPABASE_URL;

  if (
    source === "SIMULATED" ||
    source === "MENTA_TEST"
  ) {
    if (!isAuthorizedIntegration) {
      throw new Error(
        "La fuente de operaciones POS no está autorizada en este ambiente."
      );
    }

    return source;
  }

  if (source !== "MENTA_DIRECT") {
    throw new Error(
      "La fuente de operaciones POS no es válida."
    );
  }

  if (isPosIntegrationEnvironment()) {
    throw new Error(
      "El ambiente de integración no puede utilizar MENTA_DIRECT."
    );
  }

  return "MENTA_DIRECT";
}