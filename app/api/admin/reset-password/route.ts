import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = body.userId;
    const newPassword = body.password;

    if (!userId) {
      return NextResponse.json(
        { error: "Falta userId" },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const { error: appUserError } = await supabaseAdmin
      .from("app_users")
      .update({ must_change_password: false })
      .eq("id", userId);

    if (appUserError) {
      return NextResponse.json(
        {
          error:
            "La contraseña se actualizó, pero no se pudo actualizar el estado del usuario: " +
            appUserError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error: any) {
    console.error("RESET PASSWORD ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}