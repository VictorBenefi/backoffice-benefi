import "./globals.css";
import { Toaster } from "sonner";

export const metadata = {
  title: "BENEFI BackOffice",
  description: "Sistema de gestión BENEFI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}

        {/* 🔔 Notificaciones PRO */}
        <Toaster
          position="top-right"
          richColors
          expand
          closeButton
          duration={3000}
          toastOptions={{
            style: {
              fontSize: "14px",
              borderRadius: "10px",
            },
          }}
        />
      </body>
    </html>
  );
}