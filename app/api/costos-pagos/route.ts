import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/require-admin-api";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  try {
    await requireAdminApi();

    const { data, error } = await supabaseAdmin
      .from("benefi_payment_cost_settings")
      .select(`
        id,
        payment_method,
        acquirer_rate,
        menta_rate,
        panda_rate,
        valid_from,
        valid_to,
        is_active,
        notes,
        created_at,
        updated_at
      `)
      .order("payment_method", { ascending: true })
      .order("valid_from", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      settings: data ?? [],
    });
  } catch (error) {
    console.error(
      "Error obteniendo costos de pagos:",
      error
    );

    return NextResponse.json(
      {
        error: "No se pudieron obtener los costos de pagos.",
      },
      { status: 500 }
    );
  }
}
export async function POST(request: Request) {
  try {
    await requireAdminApi();

    const body = await request.json();

    const paymentMethod = String(
      body.payment_method || ""
    ).toUpperCase();

    const acquirerRate = Number(body.acquirer_rate);
    const mentaRate = Number(body.menta_rate);
    const pandaRate = Number(body.panda_rate);
    const validFrom = String(body.valid_from || "");
    const notes = String(body.notes || "").trim();

    if (
      !["QR", "DEBIT", "CREDIT"].includes(paymentMethod)
    ) {
      return NextResponse.json(
        { error: "Medio de pago inválido." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(acquirerRate) ||
      !Number.isFinite(mentaRate) ||
      !Number.isFinite(pandaRate) ||
      acquirerRate < 0 ||
      mentaRate < 0 ||
      pandaRate < 0
    ) {
      return NextResponse.json(
        { error: "Los porcentajes ingresados no son válidos." },
        { status: 400 }
      );
    }

    if (!validFrom) {
      return NextResponse.json(
        { error: "La fecha de vigencia es obligatoria." },
        { status: 400 }
      );
    }

    const { data: currentSetting, error: currentError } =
      await supabaseAdmin
        .from("benefi_payment_cost_settings")
        .select("id, valid_from")
        .eq("payment_method", paymentMethod)
        .eq("is_active", true)
        .is("valid_to", null)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (currentError) {
      throw new Error(currentError.message);
    }

    if (
      currentSetting &&
      validFrom <= currentSetting.valid_from
    ) {
      return NextResponse.json(
        {
          error:
            "La nueva vigencia debe ser posterior a la configuración vigente.",
        },
        { status: 400 }
      );
    }

    if (currentSetting) {
      const previousDay = new Date(
        `${validFrom}T12:00:00`
      );

      previousDay.setDate(previousDay.getDate() - 1);

      const validTo = previousDay
        .toISOString()
        .slice(0, 10);

      const { error: closeError } = await supabaseAdmin
        .from("benefi_payment_cost_settings")
        .update({
          valid_to: validTo,
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentSetting.id);

      if (closeError) {
        throw new Error(closeError.message);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("benefi_payment_cost_settings")
      .insert({
        payment_method: paymentMethod,
        acquirer_rate: acquirerRate,
        menta_rate: mentaRate,
        panda_rate: pandaRate,
        valid_from: validFrom,
        valid_to: null,
        is_active: true,
        notes: notes || null,
      })
      .select(`
        id,
        payment_method,
        acquirer_rate,
        menta_rate,
        panda_rate,
        valid_from,
        valid_to,
        is_active,
        notes,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      setting: data,
    });
  } catch (error) {
    console.error(
      "Error creando configuración de costos:",
      error
    );

    return NextResponse.json(
      {
        error:
          "No se pudo guardar la configuración de costos.",
      },
      { status: 500 }
    );
  }
}