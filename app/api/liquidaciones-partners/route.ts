import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/get-user-role";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getPartnerCommissionSetting(
  merchantGroupId: string,
  paymentMethod: string | null,
  transactionDate: string | null,
  settings: Array<{
    merchant_group_id: string;
    payment_method: string;
    card_scope: string;
    commission_rate: number | string;
    valid_from: string;
    valid_to: string | null;
  }>
) {
  if (
    !paymentMethod ||
    !transactionDate
  ) {
    return null;
  }

  const method = paymentMethod
    .trim()
    .toUpperCase();

  const date =
    transactionDate.slice(0, 10);

  return (
    settings.find((setting) => {
      if (
        setting.merchant_group_id !==
        merchantGroupId
      ) {
        return false;
      }

      if (
        setting.payment_method
          .trim()
          .toUpperCase() !== method
      ) {
        return false;
      }

      // Actualmente todas las tarjetas
      // utilizan la misma comisión.
      if (
        setting.card_scope !== "ALL"
      ) {
        return false;
      }

      if (
        date < setting.valid_from
      ) {
        return false;
      }

      if (
        setting.valid_to &&
        date > setting.valid_to
      ) {
        return false;
      }

      return true;
    }) || null
  );
}

function getMentaTransactionId(
  rawPayload: unknown
) {
  if (
    !rawPayload ||
    typeof rawPayload !== "object" ||
    Array.isArray(rawPayload)
  ) {
    return null;
  }

  const payload =
    rawPayload as Record<
      string,
      unknown
    >;

  const transactionId =
    payload.transaction_id;

  return typeof transactionId === "string" &&
    transactionId.trim()
    ? transactionId.trim()
    : null;
}

export async function GET(
  request: NextRequest
) {
  const role = await getUserRole();

  if (role !== "admin") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  const { searchParams } =
    new URL(request.url);

  const month =
    searchParams.get("month");

  if (
    !month ||
    !/^\d{4}-\d{2}$/.test(month)
  ) {
    return NextResponse.json(
      {
        error:
          "El período debe tener formato YYYY-MM",
      },
      { status: 400 }
    );
  }

  const { data: partners, error: partnersError } =
  await supabase
    .from("merchant_groups")
    .select(`
      id,
      name
    `)
    .eq("is_partner", true)
    .eq("is_active", true)
    .order("name", {
      ascending: true,
    });

if (partnersError) {
  console.error(
    "Error cargando Partners:",
    partnersError
  );

  return NextResponse.json(
    {
      error:
        "No se pudieron cargar los Partners",
    },
    { status: 500 }
  );
}

const partnerIds = (partners || []).map(
  (partner) => partner.id
);

if (partnerIds.length === 0) {
  return NextResponse.json({
    ok: true,
    month,
    partners: [],
    settings: [],
    merchants: [],
  });
}

const { data: settings, error: settingsError } =
  await supabase
    .from("partner_commission_settings")
    .select(`
      id,
      merchant_group_id,
      payment_method,
      card_scope,
      commission_rate,
      valid_from,
      valid_to,
      is_active
    `)
    .in("merchant_group_id", partnerIds)
    .order("valid_from", {
      ascending: false,
    });

if (settingsError) {
  console.error(
    "Error cargando configuraciones Partner:",
    settingsError
  );

  return NextResponse.json(
    {
      error:
        "No se pudieron cargar las configuraciones Partner",
    },
    { status: 500 }
  );
}

const {
  data: merchants,
  error: merchantsError,
} = await supabase
  .from("merchants")
  .select(`
    id,
    name,
    merchant_group_id
  `)
  .in("merchant_group_id", partnerIds);

if (merchantsError) {
  console.error(
    "Error cargando comercios Partner:",
    merchantsError
  );

  return NextResponse.json(
    {
      error:
        "No se pudieron cargar los comercios Partner",
    },
    { status: 500 }
  );
}

const [year, monthNumber] = month
  .split("-")
  .map(Number);

const nextYear =
  monthNumber === 12
    ? year + 1
    : year;

const nextMonthNumber =
  monthNumber === 12
    ? 1
    : monthNumber + 1;

const startDateTime =
  `${year}-${String(
    monthNumber
  ).padStart(
    2,
    "0"
  )}-01T00:00:00-03:00`;

const nextMonthDateTime =
  `${nextYear}-${String(
    nextMonthNumber
  ).padStart(
    2,
    "0"
  )}-01T00:00:00-03:00`;

const merchantIds = (
  merchants || []
).map(
  (merchant: {
    id: string;
    name: string;
    merchant_group_id: string | null;
  }) => merchant.id
);

let transactions: Array<{
  id: string;
  merchant_id_benefi: string | null;
  operation_number: string | null;
  operation_type: string | null;
  payment_method: string | null;
  gross_amount: number | string | null;
  transaction_datetime: string | null;
  operation_detail: unknown;
  raw_payload: unknown;
}> = [];

if (merchantIds.length > 0) {
  const {
    data: transactionData,
    error: transactionsError,
  } = await supabase
    .from("menta_transactions")
    .select(`
        id,
        merchant_id_benefi,
        operation_number,
        operation_type,
        payment_method,
        gross_amount,
        transaction_datetime,
        operation_detail,
        raw_payload
        `)
    .in(
      "merchant_id_benefi",
      merchantIds
    )
    .eq("status", "APPROVED")
    .gte(
      "transaction_datetime",
      startDateTime
    )
    .lt(
      "transaction_datetime",
      nextMonthDateTime
    )
    .order("transaction_datetime", {
      ascending: false,
    });

  if (transactionsError) {
    console.error(
      "Error cargando operaciones Partner:",
      transactionsError
    );

    return NextResponse.json(
      {
        error:
          "No se pudieron cargar las operaciones Partner",
      },
      { status: 500 }
    );
  }

  transactions = transactionData || [];
}

const merchantGroupMap = new Map(
  (merchants || []).map(
    (merchant) => [
      merchant.id,
      merchant.merchant_group_id,
    ]
  )
);

const merchantNameMap = new Map(
  (merchants || []).map(
    (merchant) => [
      merchant.id,
      merchant.name,
    ]
  )
);

const partnerMap = new Map(
  (partners || []).map(
    (partner) => [
      partner.id,
      partner.name,
    ]
  )
);
const annulledTransactionIds =
  new Set<string>();

for (const transaction of transactions) {
  const operationType =
  transaction.operation_type
    ?.trim()
    .toUpperCase();

if (
  operationType !== "ANNULMENT" &&
  operationType !== "REFUND"
) {
  continue;
}

  const transactionId =
    getMentaTransactionId(
      transaction.raw_payload
    );

  if (transactionId) {
    annulledTransactionIds.add(
      transactionId
    );
  }
}

const validTransactions =
  transactions.filter(
    (transaction) => {
      const transactionId =
        getMentaTransactionId(
          transaction.raw_payload
        );

      if (
        transactionId &&
        annulledTransactionIds.has(
          transactionId
        )
      ) {
        return false;
      }

      return true;
    }
  );

const operationDetails =
  validTransactions.map(
  (transaction) => {
    const merchantGroupId =
      merchantGroupMap.get(
        transaction.merchant_id_benefi || ""
      );

    const setting =
      merchantGroupId
        ? getPartnerCommissionSetting(
            merchantGroupId,
            transaction.payment_method,
            transaction.transaction_datetime,
            settings || []
          )
        : null;

    const grossAmount = Number(
      transaction.gross_amount || 0
    );

    const commissionRate = setting
      ? Number(
          setting.commission_rate || 0
        )
      : 0;

    const partnerCommission =
      grossAmount *
      (commissionRate / 100);

    return {
      id: transaction.id,
      partner_id:
        merchantGroupId || null,
      partner_name:
        merchantGroupId
          ? partnerMap.get(
              merchantGroupId
            ) || "Sin Partner"
          : "Sin Partner",
      merchant_id:
        transaction.merchant_id_benefi,

      merchant_name:
        merchantNameMap.get(
            transaction.merchant_id_benefi || ""
        ) || "Sin comercio",
      operation_number:
        transaction.operation_number,
      operation_type:
        transaction.operation_type,
      payment_method:
        transaction.payment_method,
      transaction_datetime:
        transaction.transaction_datetime,
      gross_amount:
        grossAmount,
      commission_rate:
        commissionRate,
      partner_commission:
        partnerCommission,
    };
  }
);

const partnerSummaryMap = new Map<
  string,
  {
    partner_id: string;
    partner_name: string;
    operation_count: number;
    gross_amount: number;
    partner_commission: number;
    by_payment_method: Record<
      string,
      {
        operation_count: number;
        gross_amount: number;
        partner_commission: number;
      }
    >;
  }
>();

for (const operation of operationDetails) {
  if (!operation.partner_id) {
    continue;
  }

  const current: {
  partner_id: string;
  partner_name: string;
  operation_count: number;
  gross_amount: number;
  partner_commission: number;
  by_payment_method: Record<
    string,
    {
      operation_count: number;
      gross_amount: number;
      partner_commission: number;
    }
  >;
} =
  partnerSummaryMap.get(
    operation.partner_id
  ) || {
    partner_id: operation.partner_id,
    partner_name:
      operation.partner_name,
    operation_count: 0,
    gross_amount: 0,
    partner_commission: 0,
    by_payment_method: {},
  };

  current.operation_count += 1;
  current.gross_amount +=
    operation.gross_amount;
  current.partner_commission +=
    operation.partner_commission;

  const paymentMethod =
    operation.payment_method ||
    "UNKNOWN";

  const methodSummary =
    current.by_payment_method[
      paymentMethod
    ] || {
      operation_count: 0,
      gross_amount: 0,
      partner_commission: 0,
    };

  methodSummary.operation_count += 1;
  methodSummary.gross_amount +=
    operation.gross_amount;
  methodSummary.partner_commission +=
    operation.partner_commission;

  current.by_payment_method[
    paymentMethod
  ] = methodSummary;

  partnerSummaryMap.set(
    operation.partner_id,
    current
  );
}

const partnerSummaries =
  Array.from(
    partnerSummaryMap.values()
  ).sort((a, b) =>
    a.partner_name.localeCompare(
      b.partner_name
    )
  );

const liquidationsResult =
  await supabase
    .from("partner_liquidations")
    .select(`
      id,
      merchant_group_id,
      year,
      month,
      status,
      operation_count,
      gross_amount,
      commission_amount,
      closed_at,
      paid_at,
      notes
    `)
    .eq("year", year)
    .eq("month", monthNumber);

if (liquidationsResult.error) {
  console.error(
    "Error cargando liquidaciones Partner:",
    liquidationsResult.error
  );

  return NextResponse.json(
    {
      error:
        "No se pudieron cargar las liquidaciones Partner",
    },
    { status: 500 }
  );
}

const liquidationMap = new Map(
  (liquidationsResult.data || []).map(
    (liquidation) => [
      liquidation.merchant_group_id,
      liquidation,
    ]
  )
);

const finalSummaries =
  partnerSummaries.map((summary) => {
    const liquidation =
      liquidationMap.get(
        summary.partner_id
      );

    return {
      ...summary,

      liquidation_id:
        liquidation?.id || null,

      status:
        liquidation?.status || "OPEN",

      closed_at:
        liquidation?.closed_at || null,

      paid_at:
        liquidation?.paid_at || null,

      saved_operation_count:
        liquidation
          ? Number(
              liquidation.operation_count
            )
          : null,

      saved_gross_amount:
        liquidation
          ? Number(
              liquidation.gross_amount
            )
          : null,

      saved_commission_amount:
        liquidation
          ? Number(
              liquidation.commission_amount
            )
          : null,
    };
  });

return NextResponse.json({
  ok: true,
  month,
  partners: partners || [],
  settings: settings || [],
  merchants: merchants || [],
  operations: operationDetails,
  summaries: finalSummaries,
});
}
export async function POST(
  request: NextRequest
) {
  const role = await getUserRole();

  if (role !== "admin") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const merchantGroupId = String(
      body.merchant_group_id || ""
    );

    const month = String(
      body.month || ""
    );

    if (
      !merchantGroupId ||
      !/^\d{4}-\d{2}$/.test(month)
    ) {
      return NextResponse.json(
        {
          error:
            "Datos de liquidación inválidos",
        },
        { status: 400 }
      );
    }

    const [year, monthNumber] = month
      .split("-")
      .map(Number);

    const now = new Date();

    const argentinaFormatter =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "America/Argentina/Buenos_Aires",
          year: "numeric",
          month: "2-digit",
        }
      );

    const currentMonth =
      argentinaFormatter.format(now);

    if (month >= currentMonth) {
      return NextResponse.json(
        {
          error:
            "Solo se pueden cerrar períodos ya finalizados.",
        },
        { status: 400 }
      );
    }

    const operationCount = Number(
      body.operation_count || 0
    );

    const grossAmount = Number(
      body.gross_amount || 0
    );

    const commissionAmount = Number(
      body.commission_amount || 0
    );

    const { data, error } =
      await supabase
        .from("partner_liquidations")
        .insert({
          merchant_group_id:
            merchantGroupId,
          year,
          month: monthNumber,
          status: "CLOSED",
          operation_count:
            operationCount,
          gross_amount:
            grossAmount,
          commission_amount:
            commissionAmount,
          closed_at:
            new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Error cerrando liquidación Partner:",
        error
      );

      return NextResponse.json(
        {
          error:
            "No se pudo cerrar la liquidación Partner",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      liquidation: data,
    });
  } catch (error) {
    console.error(
      "Error inesperado cerrando liquidación Partner:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error inesperado al cerrar la liquidación Partner",
      },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: NextRequest
) {
  const role = await getUserRole();

  if (role !== "admin") {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const liquidationId = String(
      body.liquidation_id || ""
    );

    const paidAt = String(
      body.paid_at || ""
    );

    if (!liquidationId || !paidAt) {
      return NextResponse.json(
        {
          error:
            "Debés indicar la liquidación y la fecha de pago.",
        },
        { status: 400 }
      );
    }

    const {
      data: liquidation,
      error: liquidationError,
    } = await supabase
      .from("partner_liquidations")
      .select(`
        id,
        status
      `)
      .eq("id", liquidationId)
      .single();

    if (liquidationError || !liquidation) {
      return NextResponse.json(
        {
          error:
            "No se encontró la liquidación Partner.",
        },
        { status: 404 }
      );
    }

    if (liquidation.status !== "CLOSED") {
      return NextResponse.json(
        {
          error:
            "Solo una liquidación cerrada puede registrarse como pagada.",
        },
        { status: 400 }
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("partner_liquidations")
      .update({
        status: "PAID",
        paid_at: paidAt,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", liquidationId)
      .eq("status", "CLOSED")
      .select()
      .single();

    if (error) {
      console.error(
        "Error registrando pago Partner:",
        error
      );

      return NextResponse.json(
        {
          error:
            "No se pudo registrar el pago de la liquidación Partner.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      liquidation: data,
    });
  } catch (error) {
    console.error(
      "Error inesperado registrando pago Partner:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Error inesperado al registrar el pago.",
      },
      { status: 500 }
    );
  }
}