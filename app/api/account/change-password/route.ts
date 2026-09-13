import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(req: Request) {
  try {
    const cookieStore =
      await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error:
            "Usuario no autenticado.",
        },
        { status: 401 }
      );
    }

    const body = await req.json();

    const password = String(
      body.password || ""
    );

    if (
      !password ||
      password.length < 6
    ) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe tener al menos 6 caracteres.",
        },
        { status: 400 }
      );
    }

    const {
      data: appUser,
      error: appUserError,
    } = await supabaseAdmin
      .from("app_users")
      .select(
        "id, is_active"
      )
      .eq(
        "auth_user_id",
        user.id
      )
      .maybeSingle();

    if (
      appUserError ||
      !appUser ||
      appUser.is_active === false
    ) {
      return NextResponse.json(
        {
          error:
            "Usuario no autorizado.",
        },
        { status: 403 }
      );
    }

    const {
      error: passwordError,
    } =
      await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        {
          password,
        }
      );

    if (passwordError) {
      return NextResponse.json(
        {
          error:
            passwordError.message,
        },
        { status: 400 }
      );
    }

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("app_users")
      .update({
        must_change_password: false,
      })
      .eq(
        "auth_user_id",
        user.id
      );

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "La contraseña se actualizó, pero no se pudo actualizar el estado del usuario.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Contraseña actualizada correctamente.",
    });
  } catch (error: unknown) {
    console.error(
      "CHANGE PASSWORD ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error interno.",
      },
      { status: 500 }
    );
  }
}