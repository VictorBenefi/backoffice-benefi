import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userId = String(body.userId || "");
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!userId) {
      return NextResponse.json({ error: "Falta userId." }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Falta email." }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password }
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
      .eq("email", email);

    if (appUserError) {
      return NextResponse.json(
        { error: appUserError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada correctamente.",
    });
  } catch (error: any) {
    console.error("CHANGE PASSWORD ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Error interno al cambiar la contraseña.",
      },
      { status: 500 }
    );
  }
}