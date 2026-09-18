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
        .from("merchant_groups")
      .select(`
        id,
        name,
        legal_name,
        cuit,
        is_active,
        is_partner,
        created_at,
        updated_at
      `)
      .order("name", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      groups: data || [],
    });
  } catch (error) {
    console.error(
      "Error cargando grupos:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los grupos.",
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

    const name = String(
      body.name || ""
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Debés ingresar el nombre del grupo.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
        .from("merchant_groups")
      .insert({
        name,
        legal_name:
          String(
            body.legal_name || ""
          ).trim() || null,
        cuit:
          String(
            body.cuit || ""
          ).trim() || null,
        is_active: true,
        is_partner:
          body.is_partner === true,
      })
      .select(`
        id,
        name,
        legal_name,
        cuit,
        is_active,
        is_partner,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      group: data,
    });
  } catch (error) {
    console.error(
      "Error creando grupo:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el grupo.",
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
            "No se recibió el grupo a modificar.",
        },
        { status: 400 }
      );
    }

    const updates: {
      name?: string;
      legal_name?: string | null;
      cuit?: string | null;
      is_active?: boolean;
      is_partner?: boolean;
      updated_at: string;
    } = {
      updated_at:
        new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = String(
        body.name || ""
      ).trim();

      if (!name) {
        return NextResponse.json(
          {
            error:
              "Debés ingresar el nombre del grupo.",
          },
          { status: 400 }
        );
      }

      updates.name = name;
    }

    if (
      body.legal_name !== undefined
    ) {
      updates.legal_name =
        String(
          body.legal_name || ""
        ).trim() || null;
    }

    if (body.cuit !== undefined) {
      updates.cuit =
        String(
          body.cuit || ""
        ).trim() || null;
    }

    if (
      typeof body.is_active ===
      "boolean"
    ) {
      updates.is_active =
        body.is_active;
    }

    if (
      typeof body.is_partner ===
      "boolean"
    ) {
      updates.is_partner =
        body.is_partner;
    }

    const { data, error } =
      await supabaseAdmin
        .from("merchant_groups")
        .update(updates)
        .eq("id", id)
        .select(`
          id,
          name,
          legal_name,
          cuit,
          is_active,
          is_partner,
          created_at,
          updated_at
        `)
        .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      group: data,
    });
  } catch (error) {
    console.error(
      "Error actualizando grupo:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el grupo.",
      },
      { status: 500 }
    );
  }
}