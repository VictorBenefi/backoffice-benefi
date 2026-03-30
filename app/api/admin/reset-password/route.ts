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

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
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