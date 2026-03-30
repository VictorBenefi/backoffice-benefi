import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUserRole } from "@/lib/get-user-role";

export default async function DashboardPage() {
  const role = await getUserRole();
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

  const [posRes, movRes, vendorRes, merchantRes] = await Promise.all([
    supabase.from("pos_devices").select("*"),
    supabase
      .from("pos_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("vendors").select("*"),
    supabase.from("merchants").select("*"),
  ]);

  const posDevices = posRes.data || [];
  const movements = movRes.data || [];
  const vendors = vendorRes.data || [];
  const merchants = merchantRes.data || [];

  const totalPos = posDevices.length;
  const posInStock = posDevices.filter((p) => p.status === "in_stock").length;
  const posMaintenance = posDevices.filter(
    (p) => p.status === "maintenance"
  ).length;
  const posInactive = posDevices.filter((p) => p.status === "inactive").length;
  const posWithoutMerchant = posDevices.filter(
    (p) => p.status === "assigned_vendor" && !p.merchant_id
  ).length;

  const cards = [
    { title: "Total POS", value: totalPos },
    { title: "En stock", value: posInStock },
    { title: "En mantenimiento", value: posMaintenance },
    { title: "Sin comercio", value: posWithoutMerchant },
  ];

  const posByVendor = vendors.map((vendor) => {
    const count = posDevices.filter((p) => p.vendor_id === vendor.id).length;

    return {
      name: vendor.name || "Sin nombre",
      count,
    };
  });

  const getMovementLabel = (type: string) => {
    switch (type) {
      case "ingreso_stock":
        return "Ingreso a stock";
      case "asignado_vendedor":
        return "Asignado a vendedor";
      case "asignado_comercio":
        return "Asignado a comercio";
      case "retorno_stock":
        return "Retorno a stock";
      case "mantenimiento":
        return "En mantenimiento";
      case "baja":
        return "Baja";
      default:
        return type;
    }
  };

  const getMovementBadgeClass = (type: string) => {
    switch (type) {
      case "ingreso_stock":
        return "bg-emerald-100 text-emerald-700";
      case "asignado_vendedor":
        return "bg-blue-100 text-blue-700";
      case "asignado_comercio":
        return "bg-violet-100 text-violet-700";
      case "retorno_stock":
        return "bg-cyan-100 text-cyan-700";
      case "mantenimiento":
        return "bg-amber-100 text-amber-700";
      case "baja":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const vendorsWithoutPos = vendors.filter(
    (vendor) => !posDevices.some((pos) => pos.vendor_id === vendor.id)
  );

  const merchantsWithoutPos = merchants.filter(
    (merchant) => !posDevices.some((pos) => pos.merchant_id === merchant.id)
  );

  const posAssignedMerchantWithoutVendor = posDevices.filter(
    (pos) => pos.status === "assigned_merchant" && !pos.vendor_id
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 mb-6">
        <p className="text-sm text-slate-500">Rol del usuario logueado</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">
          {role || "Sin rol asignado"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200"
          >
            <p className="text-sm text-slate-500">{card.title}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Alertas operativas</h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">POS en stock</p>
            <p className="mt-3 text-3xl font-bold text-emerald-600">
              {posInStock}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">En mantenimiento</p>
            <p className="mt-3 text-3xl font-bold text-amber-600">
              {posMaintenance}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">Sin comercio asignado</p>
            <p className="mt-3 text-3xl font-bold text-red-600">
              {posWithoutMerchant}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
            <p className="text-sm text-slate-500">POS inactivos</p>
            <p className="mt-3 text-3xl font-bold text-slate-600">
              {posInactive}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Alertas inteligentes</h2>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Vendedores sin POS</h3>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-bold text-rose-700">
                {vendorsWithoutPos.length}
              </span>
            </div>

            {vendorsWithoutPos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin alertas.</p>
            ) : (
              <div className="space-y-2">
                {vendorsWithoutPos.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    {vendor.name || "Sin nombre"}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Comercios sin POS</h3>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">
                {merchantsWithoutPos.length}
              </span>
            </div>

            {merchantsWithoutPos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin alertas.</p>
            ) : (
              <div className="space-y-2">
                {merchantsWithoutPos.map((merchant) => (
                  <div
                    key={merchant.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    {merchant.name || "Sin nombre"}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">POS en comercio sin vendedor</h3>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-700">
                {posAssignedMerchantWithoutVendor.length}
              </span>
            </div>

            {posAssignedMerchantWithoutVendor.length === 0 ? (
              <p className="text-sm text-slate-500">Sin alertas.</p>
            ) : (
              <div className="space-y-2">
                {posAssignedMerchantWithoutVendor.map((pos) => (
                  <div
                    key={pos.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    {pos.code || "Sin código"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">POS por vendedor</h2>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          {posByVendor.length === 0 ? (
            <p className="text-gray-500">No hay vendedores cargados.</p>
          ) : (
            <div className="space-y-3">
              {posByVendor.map((v) => (
                <div
                  key={v.name}
                  className="flex items-center justify-between border-b border-slate-200 pb-2"
                >
                  <p className="text-sm font-medium text-slate-700">{v.name}</p>
                  <span className="text-sm font-bold text-slate-900">
                    {v.count} POS
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-4">Últimos movimientos</h2>

        {movements.length === 0 ? (
          <p className="text-gray-500">No hay movimientos recientes.</p>
        ) : (
          <div className="space-y-3">
            {movements.map((mov) => (
              <div
                key={mov.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMovementBadgeClass(
                      mov.type
                    )}`}
                  >
                    {getMovementLabel(mov.type)}
                  </span>
                </div>

                <p className="text-sm text-slate-600">
                  {mov.notes || "Sin detalle"}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {new Date(mov.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}