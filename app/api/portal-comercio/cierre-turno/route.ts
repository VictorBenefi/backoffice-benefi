import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMerchantAccess } from "@/lib/get-merchant-access";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const merchantAccess =
      await getMerchantAccess();

    if (!merchantAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tenés acceso al Portal Comercio.",
        },
        { status: 403 }
      );
    }

    const fullMerchantAccessIds =
      merchantAccess.fullMerchantAccessIds;

    const allowedBranchIds =
      merchantAccess.allowedBranchIds;

    if (
      fullMerchantAccessIds.length === 0 &&
      allowedBranchIds.length === 0
    ) {
      return NextResponse.json({
        ok: true,
        posDevices: [],
      });
    }

    let posQuery = supabase
      .from("pos_devices")
      .select(`
        id,
        code,
        serial,
        merchant_reference,
        merchant_id,
        merchant_branch_id
        `);
    if (
      fullMerchantAccessIds.length > 0 &&
      allowedBranchIds.length > 0
    ) {
      posQuery = posQuery.or(
        [
          `merchant_id.in.(${fullMerchantAccessIds.join(
            ","
          )})`,
          `merchant_branch_id.in.(${allowedBranchIds.join(
            ","
          )})`,
        ].join(",")
      );
    } else if (
      fullMerchantAccessIds.length > 0
    ) {
      posQuery = posQuery.in(
        "merchant_id",
        fullMerchantAccessIds
      );
    } else if (
      allowedBranchIds.length > 0
    ) {
      posQuery = posQuery.in(
        "merchant_branch_id",
        allowedBranchIds
      );
    }

    const { data, error } =
      await posQuery.order("code", {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `POS: ${error.message}`
      );
    }

    const merchantIds = Array.from(
  new Set(
    (data || [])
      .map((pos) => pos.merchant_id)
      .filter(
        (id): id is string =>
          Boolean(id)
      )
  )
);

let merchants: {
  id: string;
  name: string | null;
}[] = [];

if (merchantIds.length > 0) {
  const {
    data: merchantsData,
    error: merchantsError,
  } = await supabase
    .from("merchants")
    .select("id, name")
    .in("id", merchantIds);

  if (merchantsError) {
    throw new Error(
      `Comercios: ${merchantsError.message}`
    );
  }

  merchants = merchantsData || [];
}

    return NextResponse.json({
    ok: true,
    posDevices: data || [],
    merchants,
    });
  } catch (error) {
    console.error(
      "Error cargando POS para cierre de turno:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los POS.",
      },
      { status: 500 }
    );
  }
}
export async function POST(request: Request) {
  try {
    const merchantAccess =
      await getMerchantAccess();

    if (!merchantAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tenés acceso al Portal Comercio.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const posIds = Array.isArray(body.posIds)
      ? body.posIds.filter(
          (value: unknown) =>
            typeof value === "string"
        )
      : [];

    const dateFrom =
      typeof body.dateFrom === "string"
        ? body.dateFrom
        : "";

    const timeFrom =
      typeof body.timeFrom === "string"
        ? body.timeFrom
        : "";

    const dateTo =
      typeof body.dateTo === "string"
        ? body.dateTo
        : "";

    const timeTo =
      typeof body.timeTo === "string"
        ? body.timeTo
        : "";

    if (
      posIds.length === 0 ||
      !dateFrom ||
      !timeFrom ||
      !dateTo ||
      !timeTo
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Debés seleccionar POS y completar el período.",
        },
        { status: 400 }
      );
    }

    const fromDateTime =
      `${dateFrom}T${timeFrom}:00-03:00`;

    const toDateTime =
      `${dateTo}T${timeTo}:59.999-03:00`;

    const fromTimestamp =
      new Date(fromDateTime).getTime();

    const toTimestamp =
      new Date(toDateTime).getTime();

    if (
      Number.isNaN(fromTimestamp) ||
      Number.isNaN(toTimestamp)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El período seleccionado no es válido.",
        },
        { status: 400 }
      );
    }

    if (toTimestamp < fromTimestamp) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La fecha y hora hasta debe ser posterior a la fecha y hora desde.",
        },
        { status: 400 }
      );
    }

    const fullMerchantAccessIds =
      merchantAccess.fullMerchantAccessIds;

    const allowedBranchIds =
      merchantAccess.allowedBranchIds;

    /*
     * Primero obtenemos los POS a los que
     * realmente tiene acceso el usuario.
     */
    let allowedPosQuery = supabase
      .from("pos_devices")
      .select(`
        id,
        code,
        serial,
        merchant_reference,
        merchant_id,
        merchant_branch_id
      `);

    if (
      fullMerchantAccessIds.length > 0 &&
      allowedBranchIds.length > 0
    ) {
      allowedPosQuery =
        allowedPosQuery.or(
          [
            `merchant_id.in.(${fullMerchantAccessIds.join(
              ","
            )})`,
            `merchant_branch_id.in.(${allowedBranchIds.join(
              ","
            )})`,
          ].join(",")
        );
    } else if (
      fullMerchantAccessIds.length > 0
    ) {
      allowedPosQuery =
        allowedPosQuery.in(
          "merchant_id",
          fullMerchantAccessIds
        );
    } else if (
      allowedBranchIds.length > 0
    ) {
      allowedPosQuery =
        allowedPosQuery.in(
          "merchant_branch_id",
          allowedBranchIds
        );
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tenés POS habilitados.",
        },
        { status: 403 }
      );
    }

    const {
      data: allowedPos,
      error: allowedPosError,
    } = await allowedPosQuery;

    if (allowedPosError) {
      throw new Error(
        `POS: ${allowedPosError.message}`
      );
    }

    const allowedPosIds = new Set(
      (allowedPos || []).map(
        (pos) => pos.id
      )
    );

    const invalidPos =
      posIds.some(
        (posId: string) =>
          !allowedPosIds.has(posId)
      );

    if (invalidPos) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Uno o más POS seleccionados no están autorizados.",
        },
        { status: 403 }
      );
    }

    /*
     * Consulta paginada.
     * Evitamos el límite de 500/1000
     * registros de una sola consulta.
     */
    const pageSize = 1000;
    let from = 0;

    const transactions: Record<
      string,
      unknown
    >[] = [];

    while (true) {
      const {
        data,
        error,
      } = await supabase
        .from("menta_transactions")
        .select(`
          id,
          pos_id,
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
        `)
        .in("pos_id", posIds)
        .gte(
          "transaction_datetime",
          fromDateTime
        )
        .lte(
          "transaction_datetime",
          toDateTime
        )
        .order(
          "transaction_datetime",
          { ascending: true }
        )
        .range(
          from,
          from + pageSize - 1
        );

      if (error) {
        throw new Error(
          `Operaciones: ${error.message}`
        );
      }

      const rows = data || [];

      transactions.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    const selectedPos =
      (allowedPos || []).filter(
        (pos) =>
          posIds.includes(pos.id)
      );

    return NextResponse.json({
      ok: true,
      period: {
        from: fromDateTime,
        to: toDateTime,
      },
      posDevices: selectedPos,
      transactions,
    });
  } catch (error) {
    console.error(
      "Error generando cierre de turno:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el cierre de turno.",
      },
      { status: 500 }
    );
  }
}