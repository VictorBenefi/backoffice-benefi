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

const allowedRoles = [
  "admin",
  "operaciones",
  "supervisor",
  "vendedor",
  "soporte",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Debés ingresar el nombre." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Debés ingresar el email." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Rol inválido." },
        { status: 400 }
      );
    }

    const { data: existingAppUser, error: appUserCheckError } =
      await supabaseAdmin
        .from("app_users")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

    if (appUserCheckError) {
      return NextResponse.json(
        { error: appUserCheckError.message },
        { status: 500 }
      );
    }

    if (existingAppUser) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email." },
        { status: 400 }
      );
    }

    const { data: createdUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !createdUser.user) {
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario." },
        { status: 400 }
      );
    }

    const authUserId = createdUser.user.id;

    const insertPayload = {
      auth_user_id: authUserId,
      name,
      email,
      role,
      is_active: true,
      must_change_password: true,
    };

    console.log("CREATE USER INSERT PAYLOAD:", insertPayload);

    const { data: insertedUser, error: insertError } = await supabaseAdmin
      .from("app_users")
      .insert([insertPayload])
      .select("id, auth_user_id, email, must_change_password")
      .single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    if (!insertedUser?.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);

      return NextResponse.json(
        {
          error:
            "El usuario se creó en autenticación, pero app_users no guardó auth_user_id.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Usuario creado correctamente.",
      user: insertedUser,
    });
  } catch (error: any) {
    console.error("ERROR CREATE USER API:", error);

    return NextResponse.json(
      {
        error: error?.message || "Ocurrió un error al crear el usuario.",
      },
      { status: 500 }
    );
  }
}