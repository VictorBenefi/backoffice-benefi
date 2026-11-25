import { NextRequest, NextResponse } from "next/server";

const allowedRoutes = new Map<string, string>([
  ["/api/pos/terminals", "GET"],
  ["/api/pos/shift-closures/preview", "POST"],
  ["/api/pos/shift-closures/confirm", "POST"],
  ["/api/pos/shift-closures/cancel", "POST"],
  ["/api/pos/shift-closures/history", "GET"],
  ["/api/pos/shift-closures/detail", "GET"],
]);

export function proxy(request: NextRequest) {
  const integrationOnly =
    process.env.POS_INTEGRATION_ONLY === "true" ||
    process.env.VERCEL_TARGET_ENV === "integration-pos";

  if (!integrationOnly) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const allowedMethod = allowedRoutes.get(pathname);

  if (!allowedMethod) {
    return NextResponse.json(
      {
        ok: false,
        code: "INTEGRATION_ROUTE_DISABLED",
        message:
          "Ruta no disponible en el ambiente de integración POS.",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (request.method !== allowedMethod) {
    return NextResponse.json(
      {
        ok: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Método HTTP no permitido.",
      },
      {
        status: 405,
        headers: {
          Allow: allowedMethod,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};