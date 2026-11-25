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

export async function POST(req: Request) {
  try {
    const admin = await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const userId = String(
      body.userId ?? ""
    ).trim();

    const isActive = body.isActive;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ||
      typeof isActive !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Datos inválidos." },
        { status: 400 }
      );
    }

    if (
      userId === admin.appUser.id &&
      !isActive
    ) {
      return NextResponse.json(
        {
          error:
            "No podés inactivar tu propia cuenta.",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from("app_users")
        .update({
          is_active: isActive,
        })
        .eq("id", userId)
        .select("id, is_active")
        .maybeSingle();

    if (error) {
      console.error(
        "ERROR UPDATE USER STATUS:",
        error
      );

      return NextResponse.json(
        {
          error:
            "No se pudo actualizar el usuario.",
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: data,
    });
  } catch (error) {
    console.error(
      "ERROR UPDATE USER STATUS:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ocurrió un error al actualizar el usuario.",
      },
      { status: 500 }
    );
  }
}