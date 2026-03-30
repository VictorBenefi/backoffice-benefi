import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getUserRole() {
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

  if (!user?.email) return null;

  const normalizedEmail = user.email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("app_users")
    .select("role, email")
    .eq("email", normalizedEmail)
    .limit(1);

  if (error) {
    console.log("Error obteniendo rol:", error);
    return null;
  }

  return data?.[0]?.role || null;
}