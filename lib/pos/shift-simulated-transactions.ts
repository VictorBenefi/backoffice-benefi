import "server-only";

import { createClient } from "@supabase/supabase-js";

import type {
  MentaShiftTransaction,
} from "@/lib/menta/shift-transactions";

import {
  getPosShiftDataSource,
} from "@/lib/pos/shift-data-source";

type SimulatedShiftQuery = {
  merchantId: string;
  terminalIds: string[];
  start: string;
  end: string;
};

export async function getSimulatedShiftTransactions({
  merchantId,
  terminalIds,
  start,
  end,
}: SimulatedShiftQuery): Promise<MentaShiftTransaction[]> {

  if (getPosShiftDataSource() !== "SIMULATED") {
    throw new Error(
      "La fuente simulada POS no está habilitada."
    );
  }

  if (!merchantId || terminalIds.length === 0) {
    throw new Error(
      "No se identificó el comercio o las terminales de integración."
    );
  }

  const startTime = Date.parse(start);
  const endTime = Date.parse(end);

  if (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime > endTime
  ) {
    throw new Error(
      "El período simulado no es válido."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan las credenciales de Supabase de integración."
    );
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const PAGE_SIZE = 500;
  const MAX_PAGES = 100;

  const transactions: MentaShiftTransaction[] = [];
  const operationIds = new Set<string>();

  let expectedCount: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {

    const { data, error, count } = await supabase
      .from("menta_transactions")
      .select(`
        merchant_id_menta,
        terminal_id_menta,
        transaction_id,
        operation_id,
        operation_number,
        serial_number,
        operation_type,
        payment_method,
        gross_amount,
        currency,
        transaction_datetime,
        status,
        installments,
        financing,
        acquirer,
        operation_detail
      `, { count: "exact" })
      .eq("merchant_id_menta", merchantId)
      .in("terminal_id_menta", terminalIds)
      .gte("transaction_datetime", start)
      .lte("transaction_datetime", end)
      .order("transaction_datetime", { ascending: true })
      .order("id", { ascending: true })
      .range(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE - 1
      );

    if (error || !data || count === null) {
      throw new Error(
        "No se pudieron consultar las operaciones simuladas."
      );
    }

    if (expectedCount === null) {
      expectedCount = count;
    }

    if (count !== expectedCount) {
      throw new Error(
        "Las operaciones simuladas cambiaron durante la consulta."
      );
    }

    for (const row of data) {

      const operationId =
        String(row.operation_id ?? "").trim();

      if (!operationId || operationIds.has(operationId)) {
        throw new Error(
          "Se detectó una operación simulada inválida o duplicada."
        );
      }

      operationIds.add(operationId);

      transactions.push({
        merchant_id: row.merchant_id_menta,
        terminal_id: row.terminal_id_menta,
        transaction_id: row.transaction_id,
        operation_id: operationId,
        operation_number: row.operation_number,
        serial_number: row.serial_number,
        operation_type: row.operation_type,
        payment_method: row.payment_method,
        gross_amount: row.gross_amount,
        currency: row.currency,
        datetime: row.transaction_datetime,
        status: row.status,
        installments: row.installments,
        financing: row.financing,
        acquirer: row.acquirer,
        operation_detail: row.operation_detail,
      });
    }

    if (transactions.length === expectedCount) {

      console.info("[POS SHIFT SIMULATED]", {
        terminalCount: terminalIds.length,
        operationCount: transactions.length,
        start,
        end,
      });

      return transactions;
    }

    if (
      data.length === 0 ||
      transactions.length > expectedCount
    ) {
      throw new Error(
        "La cantidad de operaciones simuladas no coincide."
      );
    }
  }

  throw new Error(
    "Se superó el límite de operaciones simuladas."
  );
}