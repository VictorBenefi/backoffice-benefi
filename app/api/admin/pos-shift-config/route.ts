import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/require-admin-api";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
async function readConfig(posId: string) {
  const { data, error } = await db.from("pos_devices").select("id,shift_closure_enabled_from").eq("id", posId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: closures, error: closureError } = await db.from("pos_shift_closure_terminals").select("id").eq("pos_id", posId).limit(1);
  if (closureError) throw closureError;
  return { posId, enabledFrom: data.shift_closure_enabled_from as string | null, locked: !!closures?.length };
}
export async function GET(req: Request) {
  try {
    if (!await requireAdminApi()) return fail("No autorizado.", 403);
    const posId = new URL(req.url).searchParams.get("posId") || "";
    if (!uuid.test(posId)) return fail("Terminal inválida.", 400);
    const config = await readConfig(posId);
    return config ? NextResponse.json({ ok: true, config }, { headers: { "Cache-Control": "no-store" } }) : fail("Terminal no encontrada.", 404);
  } catch (error) { console.error(error); return fail("No se pudo consultar la habilitación.", 500); }
}
export async function POST(req: Request) {
  try {
    if (!await requireAdminApi()) return fail("No autorizado.", 403);
    const body = await req.json().catch(() => null);
    if (!body || typeof body.posId !== "string" || !uuid.test(body.posId)) return fail("Terminal inválida.", 400);
    let enabledFrom: string | null = null;
    if (body.enabledFrom !== null) {
      if (typeof body.enabledFrom !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(body.enabledFrom)) return fail("Fecha inválida.", 400);
      const local = body.enabledFrom.length === 16 ? body.enabledFrom + ":00" : body.enabledFrom;
      const time = Date.parse(local + "-03:00");
      if (!Number.isFinite(time) || new Date(time - 10800000).toISOString().slice(0,19) !== local) return fail("Fecha inválida.", 400);
      enabledFrom = new Date(time).toISOString();
    }
    const config = await readConfig(body.posId);
    if (!config) return fail("Terminal no encontrada.", 404);
    if (config.locked) return fail("La terminal ya tiene cierres registrados.", 409);
    if (body.expectedEnabledFrom !== config.enabledFrom) return fail("La configuración cambió. Volvé a abrir la edición.", 409);
    let query = db.from("pos_devices").update({ shift_closure_enabled_from: enabledFrom }).eq("id", body.posId);
    query = config.enabledFrom === null ? query.is("shift_closure_enabled_from", null) : query.eq("shift_closure_enabled_from", config.enabledFrom);
    const { data, error } = await query.select("id").maybeSingle();
    if (error) { console.error(error); return fail("No se pudo guardar la habilitación. Verificá si existe un cierre registrado.", 409); }
    if (!data) return fail("La configuración cambió. Volvé a abrir la edición.", 409);
    return NextResponse.json({ ok: true, config: await readConfig(body.posId) });
  } catch (error) { console.error(error); return fail("No se pudo guardar la habilitación.", 500); }
}
