"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/logout-button";

type MenuItem = {
  href: string;
  label: string;
};

type ResponsiveProtectedShellProps = {
  children: React.ReactNode;
  role: string | null;
  menu: MenuItem[];
};

export default function ResponsiveProtectedShell({
  children,
  role,
  menu,
}: ResponsiveProtectedShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-800 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Image
                src="/logo-benefi.png"
                alt="Benefi"
                width={150}
                height={45}
                className="object-contain"
                priority
              />

              <p className="mt-2 text-xs text-slate-400">
                BackOffice operativo
              </p>

              {role ? (
                <span className="mt-3 inline-block rounded-full bg-slate-800 px-3 py-1 text-xs">
                  Rol: {role}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 text-xl text-white transition hover:bg-slate-800 lg:hidden"
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>
        </div>

        <nav className="space-y-2 px-4 py-4">
          {menu.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-slate-800 font-semibold text-white"
                    : "text-slate-200 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-800 px-6 py-6">
        <div className="mb-4 flex justify-center">
          <Image
            src="/isotipo-benefi.png"
            alt="Benefi isotipo"
            width={42}
            height={42}
            className="object-contain opacity-90"
          />
        </div>

        <LogoutButton />

        <p className="mt-3 text-center text-xs text-slate-500">
          Sistema interno BENEFI
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 min-w-[280px] bg-[#050816] text-white lg:block">
        {sidebarContent}
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />

          <aside className="relative h-dvh w-[min(84vw,320px)] overflow-hidden bg-[#050816] text-white shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl text-slate-800 shadow-sm"
              aria-label="Abrir menú"
            >
              ☰
            </button>

            <Image
              src="/logo-benefi.png"
              alt="Benefi"
              width={110}
              height={34}
              className="h-auto w-[110px] object-contain"
              priority
            />

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {role || "usuario"}
            </span>
          </div>
        </header>

        <main className="min-w-0 p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}