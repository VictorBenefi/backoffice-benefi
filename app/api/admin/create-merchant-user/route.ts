import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/require-admin-api";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
}

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

const allowedAccessRoles = [
  "local_admin",
  "brand_admin",
  "group_admin",
];

export async function POST(req: Request) {
  let authUserId: string | null = null;
  let appUserId: string | null = null;

  try {
    const admin =
        await requireAdminApi();

        if (!admin) {
        return NextResponse.json(
            {
            error: "No autorizado.",
            },
            { status: 403 }
        );
        }
    const body = await req.json();

    const name = String(
      body.name || ""
    ).trim();

    const email = String(
      body.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body.password || ""
    );

    const accessLevel = String(
      body.accessLevel || ""
    ).trim();

    const accessId = String(
      body.accessId || ""
    ).trim();

    const accessRole = String(
      body.accessRole || ""
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Debés ingresar el nombre.",
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Debés ingresar el email.",
        },
        { status: 400 }
      );
    }

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

    if (
      ![
        "branch",
        "merchant",
        "brand",
        "group",
      ].includes(accessLevel)
    ) {
      return NextResponse.json(
        {
          error:
            "Nivel de acceso inválido.",
        },
        { status: 400 }
      );
    }

    if (!accessId) {
      return NextResponse.json(
        {
          error:
          "Debés seleccionar la sucursal, comercio, marca o grupo.",
        },
        { status: 400 }
      );
    }

    if (
      !allowedAccessRoles.includes(
        accessRole
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Rol de acceso inválido.",
        },
        { status: 400 }
      );
    }

    const expectedRole =
    accessLevel === "branch" ||
    accessLevel === "merchant"
      ? "local_admin"
      : accessLevel === "brand"
        ? "brand_admin"
        : "group_admin";

    if (accessRole !== expectedRole) {
      return NextResponse.json(
        {
          error:
            "El rol no corresponde al nivel de acceso seleccionado.",
        },
        { status: 400 }
      );
    }

    const {
      data: existingAppUser,
      error: appUserCheckError,
    } = await supabaseAdmin
      .from("app_users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (appUserCheckError) {
      return NextResponse.json(
        {
          error:
            appUserCheckError.message,
        },
        { status: 500 }
      );
    }

    if (existingAppUser) {
      return NextResponse.json(
        {
          error:
            "Ya existe un usuario con ese email.",
        },
        { status: 400 }
      );
    }

    const {
      data: createdUser,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password,
          email_confirm: true,
        }
      );

    if (
      authError ||
      !createdUser.user
    ) {
      return NextResponse.json(
        {
          error:
            authError?.message ||
            "No se pudo crear el usuario.",
        },
        { status: 400 }
      );
    }

    authUserId =
      createdUser.user.id;

    const {
      data: insertedUser,
      error: insertError,
    } = await supabaseAdmin
      .from("app_users")
      .insert([
        {
          auth_user_id:
            authUserId,
          name,
          email,
          role: "merchant",
          is_active: true,
          must_change_password: true,
        },
      ])
      .select(
        "id, auth_user_id, name, email, role"
      )
      .single();

    if (
      insertError ||
      !insertedUser
    ) {
      await supabaseAdmin.auth.admin.deleteUser(
        authUserId
      );

      return NextResponse.json(
        {
          error:
            insertError?.message ||
            "No se pudo crear el usuario del Portal Comercio.",
        },
        { status: 500 }
      );
    }

    appUserId = insertedUser.id;

    const accessPayload = {
      user_id: appUserId,

      merchant_branch_id:
        accessLevel === "branch"
          ? accessId
          : null,

      merchant_id:
        accessLevel === "merchant"
          ? accessId
          : null,

      merchant_brand_id:
        accessLevel === "brand"
          ? accessId
          : null,

      merchant_group_id:
        accessLevel === "group"
          ? accessId
          : null,

      role: accessRole,
      is_active: true,
    };

    const {
      error: accessError,
    } = await supabaseAdmin
      .from(
        "merchant_user_access"
      )
      .insert([
        accessPayload,
      ]);

    if (accessError) {
      await supabaseAdmin
        .from("app_users")
        .delete()
        .eq("id", appUserId);

      await supabaseAdmin.auth.admin.deleteUser(
        authUserId
      );

      return NextResponse.json(
        {
          error:
            `No se pudo asignar el acceso al Portal Comercio: ${accessError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,

      message:
        "Usuario del Portal Comercio creado correctamente.",

      user: insertedUser,

      access: {
        level: accessLevel,
        id: accessId,
        role: accessRole,
      },
    });
  } catch (error: unknown) {
    console.error(
      "ERROR CREATE MERCHANT USER API:",
      error
    );

    if (appUserId) {
      await supabaseAdmin
        .from("app_users")
        .delete()
        .eq("id", appUserId);
    }

    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(
        authUserId
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al crear el usuario del Portal Comercio.",
      },
      { status: 500 }
    );
  }
}