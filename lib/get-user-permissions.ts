import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getUserPermissions() {
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
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("app_users")
    .select("can_manage_users, can_import_pos, can_delete_pos, can_assign_pos")
    .eq("auth_user_id", user.id)
    .single();

  if (error) {
    console.log("Error obteniendo permisos:", error);
    return null;
  }

  return data;
}