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
      .from("merchant_brands")
      .select(`
        id,
        merchant_group_id,
        name,
        is_active,
        created_at,
        updated_at,
        merchant_groups (
          id,
          name
        )
      `)
      .order("name", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      brands: data || [],
    });
  } catch (error) {
    console.error(
      "Error cargando marcas:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las marcas.",
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

    const name = String(
      body.name || ""
    ).trim();

    if (!merchantGroupId) {
      return NextResponse.json(
        {
          error:
            "Debés seleccionar un grupo.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Debés ingresar el nombre de la marca.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("merchant_brands")
      .insert({
        merchant_group_id:
          merchantGroupId,
        name,
        is_active: true,
      })
      .select(`
        id,
        merchant_group_id,
        name,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      brand: data,
    });
  } catch (error) {
    console.error(
      "Error creando marca:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la marca.",
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
            "No se recibió la marca a modificar.",
        },
        { status: 400 }
      );
    }

    const updates: {
      merchant_group_id?: string;
      name?: string;
      is_active?: boolean;
      updated_at: string;
    } = {
      updated_at:
        new Date().toISOString(),
    };

    if (
      body.merchant_group_id !== undefined
    ) {
      const merchantGroupId = String(
        body.merchant_group_id || ""
      ).trim();

      if (!merchantGroupId) {
        return NextResponse.json(
          {
            error:
              "Debés seleccionar un grupo.",
          },
          { status: 400 }
        );
      }

      updates.merchant_group_id =
        merchantGroupId;
    }

    if (body.name !== undefined) {
      const name = String(
        body.name || ""
      ).trim();

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Debés ingresar el nombre de la marca.",
          },
          { status: 400 }
        );
      }

      updates.name = name;
    }

    if (
      typeof body.is_active ===
      "boolean"
    ) {
      updates.is_active =
        body.is_active;
    }

    const { data, error } =
      await supabaseAdmin
        .from("merchant_brands")
        .update(updates)
        .eq("id", id)
        .select(`
          id,
          merchant_group_id,
          name,
          is_active,
          created_at,
          updated_at
        `)
        .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      brand: data,
    });
  } catch (error) {
    console.error(
      "Error actualizando marca:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la marca.",
      },
      { status: 500 }
    );
  }
}