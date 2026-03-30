"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-xl border border-slate-700 px-4 py-3 text-left text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
    >
      Cerrar sesión
    </button>
  );
}