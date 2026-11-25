
import "server-only";

import { mentaRequest } from "@/lib/menta/client";

export type MentaShiftTransaction = {
  merchant_id?: string | null;
  terminal_id?: string | null;
  transaction_id?: string | null;
  operation_id?: string | null;
  operation_number?: string | number | null;
  serial_number?: string | null;

  operation_type?: string | null;
  payment_method?: string | null;
  gross_amount?: number | string | null;
  currency?: string | null;
  datetime?: string | null;
  status?: string | null;
  installments?: number | string | null;
  financing?: string | null;
  acquirer?: string | null;

  operation_detail?: {
    reference_operation_id?: string | null;
    reference_operation_number?: string | number | null;

    card?: {
      card_brand?: string | null;
      is_international_card?: boolean | null;
    } | null;

    [key: string]: unknown;
  } | null;

  [key: string]: unknown;
};

type MentaShiftResponse = {
  content?: MentaShiftTransaction[];
  total_elements?: number;
  total_pages?: number;
  number_of_elements?: number;
  number?: number;
  first?: boolean;
  last?: boolean;
};

type ShiftQuery = {
  merchantId?: string;
  terminalId?: string;
  terminalIds?: string[];
  start: string;
  end: string;
};

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

export async function getMentaShiftTransactions({
  merchantId,
  terminalId,
  terminalIds,
  start,
  end,
}: ShiftQuery): Promise<MentaShiftTransaction[]> {

  const normalizedMerchantId =
    String(merchantId ?? "").trim();
  const normalizedTerminalIds = new Set(
    [
      ...(terminalIds || []),
      ...(terminalId ? [terminalId] : []),
    ]
      .map((id) => id.trim())
      .filter(Boolean)
  );

  if (normalizedTerminalIds.size === 0) {
    throw new Error(
      "No se seleccionaron terminales MENTA válidas."
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
      "El período del cierre no es válido."
    );
  }

  async function loadPage(page: number) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(PAGE_SIZE),
    start,
    end,
  });

  if (normalizedMerchantId) {
    params.set("merchantId", normalizedMerchantId);
  }

    const response =
      await mentaRequest<MentaShiftResponse>(
        `/v2/transaction-reports?${params.toString()}`
      );

    if (
      !response ||
      !Array.isArray(response.content)
    ) {
      throw new Error(
        `MENTA devolvió una página inválida: ${page}.`
      );
    }

    if (
      response.number !== undefined &&
      response.number !== page
    ) {
      throw new Error(
        "MENTA devolvió una página diferente a la solicitada."
      );
    }

    return response;
  }

  const firstPage = await loadPage(0);

  const totalPages = firstPage.total_pages;
  const totalElements = firstPage.total_elements;

  console.info("[MENTA SHIFT] Diagnóstico paginación", {
  start,
  end,
  totalPages,
  totalElements,
  maxPages: MAX_PAGES,
  pageSize: PAGE_SIZE,
  firstPageOperations: firstPage.content?.length,
});

  if (
    typeof totalPages !== "number" ||
    !Number.isInteger(totalPages) ||
    totalPages < 0 ||
    totalPages > MAX_PAGES ||
    typeof totalElements !== "number" ||
    !Number.isInteger(totalElements) ||
    totalElements < 0
  ) {
    throw new Error(
      "No se pudo verificar la paginación de MENTA."
    );
  }

  const transactions = [
    ...(firstPage.content || []),
  ];

  for (
    let page = 1;
    page < totalPages;
    page++
  ) {
    const response = await loadPage(page);

    if (
      response.total_pages !== totalPages ||
      response.total_elements !== totalElements ||
      !response.content?.length
    ) {
      throw new Error(
        "Las operaciones de MENTA cambiaron durante la consulta. Reintentar."
      );
    }

    transactions.push(...response.content);
  }

  if (transactions.length !== totalElements) {
    throw new Error(
      "La cantidad de operaciones recibidas no coincide con la informada por MENTA."
    );
  }

  const operationIds = new Set<string>();

  for (const transaction of transactions) {

  if (
    normalizedMerchantId &&
    String(transaction.merchant_id ?? "").trim() !==
      normalizedMerchantId
  ) {
    throw new Error(
      "MENTA devolvió operaciones de otro comercio."
    );
  }

  const operationId = String(
    transaction.operation_id ?? ""
  ).trim();

    if (!operationId) {
      throw new Error(
        "MENTA devolvió una operación sin identificador."
      );
    }

    if (operationIds.has(operationId)) {
      throw new Error(
        "MENTA devolvió operaciones duplicadas."
      );
    }

    operationIds.add(operationId);

    if (
      !String(transaction.terminal_id ?? "").trim()
    ) {
      throw new Error(
        "MENTA devolvió una operación sin terminal identificada."
      );
    }

    const datetime = Date.parse(
      transaction.datetime ?? ""
    );

    if (
      !Number.isFinite(datetime) ||
      datetime < startTime ||
      datetime > endTime
    ) {
      throw new Error(
        "MENTA devolvió una operación fuera del período solicitado."
      );
    }
  }

      const terminalTransactions = transactions.filter(
    (transaction) =>
      normalizedTerminalIds.has(
        String(transaction.terminal_id ?? "").trim()
      )
  );

  console.info("[MENTA SHIFT] Consulta completada", {
    terminalIds: Array.from(normalizedTerminalIds),
    start,
    end,
    totalPages,
    totalMentaOperations: transactions.length,
    terminalOperations: terminalTransactions.length,
  });

  return terminalTransactions.sort((a, b) => {
    const dateDifference =
      Date.parse(a.datetime ?? "") -
      Date.parse(b.datetime ?? "");

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return String(a.operation_id).localeCompare(
      String(b.operation_id)
    );
  });
}
