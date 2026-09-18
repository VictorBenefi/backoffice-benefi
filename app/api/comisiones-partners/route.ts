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

    const { data: groups, error: groupsError } =
      await supabaseAdmin
        .from("merchant_groups")
        .select(`
          id,
          name,
          legal_name,
          cuit,
          is_active,
          is_partner
        `)
        .eq("is_partner", true)
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        });

    if (groupsError) {
      throw new Error(groupsError.message);
    }

    const { data: settings, error: settingsError } =
      await supabaseAdmin
        .from("partner_commission_settings")
        .select(`
          id,
          merchant_group_id,
          payment_method,
          commission_rate,
          valid_from,
          valid_to,
          is_active,
          notes,
          created_at,
          updated_at
        `)
        .order("valid_from", {
          ascending: false,
        });

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    return NextResponse.json({
      partners: groups || [],
      settings: settings || [],
    });
  } catch (error) {
    console.error(
      "Error cargando comisiones Partner:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las comisiones Partner.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    await requireAdminApi();

    const body = await request.json();

    const merchantGroupId = String(
      body.merchant_group_id || ""
    ).trim();

    const paymentMethod = String(
      body.payment_method || ""
    )
      .trim()
      .toUpperCase();

    const commissionRate = Number(
      body.commission_rate
    );

    const validFrom = String(
      body.valid_from || ""
    ).trim();

    const notes =
      String(body.notes || "").trim() ||
      null;

    if (!merchantGroupId) {
      return NextResponse.json(
        {
          error:
            "Debés seleccionar un Partner.",
        },
        { status: 400 }
      );
    }

    if (
      !["QR", "DEBIT", "CREDIT"].includes(
        paymentMethod
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Debés seleccionar un medio de pago válido.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(commissionRate) ||
      commissionRate < 0
    ) {
      return NextResponse.json(
        {
          error:
            "La comisión debe ser igual o mayor a 0.",
        },
        { status: 400 }
      );
    }

    if (!validFrom) {
      return NextResponse.json(
        {
          error:
            "Debés indicar la fecha de vigencia.",
        },
        { status: 400 }
      );
    }

    const { data: partner, error: partnerError } =
      await supabaseAdmin
        .from("merchant_groups")
        .select(`
          id,
          is_partner,
          is_active
        `)
        .eq("id", merchantGroupId)
        .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        {
          error:
            "No se encontró el grupo seleccionado.",
        },
        { status: 404 }
      );
    }

    if (!partner.is_partner) {
      return NextResponse.json(
        {
          error:
            "El grupo seleccionado no está configurado como Partner.",
        },
        { status: 400 }
      );
    }

    const previousDay = new Date(
      `${validFrom}T12:00:00`
    );

    previousDay.setDate(
      previousDay.getDate() - 1
    );

    const previousValidTo =
      previousDay
        .toISOString()
        .slice(0, 10);

    const {
      error: closePreviousError,
    } = await supabaseAdmin
      .from("partner_commission_settings")
      .update({
        valid_to: previousValidTo,
        is_active: false,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "merchant_group_id",
        merchantGroupId
      )
      .eq(
        "payment_method",
        paymentMethod
      )
      .is("valid_to", null);

    if (closePreviousError) {
      throw new Error(
        closePreviousError.message
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from(
          "partner_commission_settings"
        )
        .insert({
          merchant_group_id:
            merchantGroupId,
          payment_method:
            paymentMethod,
          commission_rate:
            commissionRate,
          valid_from: validFrom,
          valid_to: null,
          is_active: true,
          notes,
        })
        .select(`
          id,
          merchant_group_id,
          payment_method,
          commission_rate,
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
      "Error guardando comisión Partner:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la comisión Partner.",
      },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: Request
) {
  try {
    await requireAdminApi();

    const body = await request.json();

    const id = String(
      body.id || ""
    ).trim();

    if (!id) {
      return NextResponse.json(
        {
          error:
            "No se recibió la configuración a modificar.",
        },
        { status: 400 }
      );
    }

    const { data: current, error: currentError } =
      await supabaseAdmin
        .from("partner_commission_settings")
        .select(`
          id,
          merchant_group_id,
          payment_method,
          commission_rate,
          valid_from,
          valid_to,
          is_active,
          notes
        `)
        .eq("id", id)
        .single();

    if (currentError || !current) {
      return NextResponse.json(
        {
          error:
            "No se encontró la configuración.",
        },
        { status: 404 }
      );
    }

    const updates: {
      commission_rate?: number;
      valid_from?: string;
      valid_to?: string | null;
      is_active?: boolean;
      notes?: string | null;
      updated_at: string;
    } = {
      updated_at:
        new Date().toISOString(),
    };

    if (
      body.commission_rate !== undefined
    ) {
      const commissionRate = Number(
        body.commission_rate
      );

      if (
        !Number.isFinite(commissionRate) ||
        commissionRate < 0
      ) {
        return NextResponse.json(
          {
            error:
              "La comisión debe ser igual o mayor a 0.",
          },
          { status: 400 }
        );
      }

      updates.commission_rate =
        commissionRate;
    }

    if (body.valid_from !== undefined) {
      const validFrom = String(
        body.valid_from || ""
      ).trim();

      if (!validFrom) {
        return NextResponse.json(
          {
            error:
              "Debés indicar la fecha de vigencia.",
          },
          { status: 400 }
        );
      }

      updates.valid_from = validFrom;
    }

    if (body.notes !== undefined) {
      updates.notes =
        String(body.notes || "").trim() ||
        null;
    }

    if (
        typeof body.is_active === "boolean"
        ) {
        updates.is_active =
            body.is_active;

        if (body.is_active) {
            updates.valid_to = null;
        } else {
            const today =
            new Date()
                .toISOString()
                .slice(0, 10);

            const validFrom =
            updates.valid_from ||
            current.valid_from;

            updates.valid_to =
            today < validFrom
                ? validFrom
                : today;
        }
    }

    const { data, error } =
      await supabaseAdmin
        .from(
          "partner_commission_settings"
        )
        .update(updates)
        .eq("id", id)
        .select(`
          id,
          merchant_group_id,
          payment_method,
          commission_rate,
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
      "Error actualizando comisión Partner:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la comisión Partner.",
      },
      { status: 500 }
    );
  }
}
export async function DELETE(
  request: Request
) {
  try {
    await requireAdminApi();

    const body = await request.json();

    const id = String(
      body.id || ""
    ).trim();

    if (!id) {
      return NextResponse.json(
        {
          error:
            "No se recibió la configuración a eliminar.",
        },
        { status: 400 }
      );
    }

    const { data: current, error: currentError } =
      await supabaseAdmin
        .from("partner_commission_settings")
        .select(`
          id,
          merchant_group_id,
          payment_method
        `)
        .eq("id", id)
        .single();

    if (currentError || !current) {
      return NextResponse.json(
        {
          error:
            "No se encontró la configuración.",
        },
        { status: 404 }
      );
    }

    const { error } =
      await supabaseAdmin
        .from("partner_commission_settings")
        .delete()
        .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Error eliminando comisión Partner:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar la comisión Partner.",
      },
      { status: 500 }
    );
  }
}