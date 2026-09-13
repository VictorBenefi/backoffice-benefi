import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function requireAdminApi() {
  const cookieStore = await cookies();

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
    return null;
  }

  const { data: appUser, error: appUserError } =
    await supabase
      .from("app_users")
      .select(`
        id,
        auth_user_id,
        email,
        role,
        is_active
      `)
      .eq("auth_user_id", user.id)
      .maybeSingle();

  if (
    appUserError ||
    !appUser ||
    appUser.is_active === false ||
    appUser.role !== "admin"
  ) {
    return null;
  }

  return {
    authUser: user,
    appUser,
  };
}