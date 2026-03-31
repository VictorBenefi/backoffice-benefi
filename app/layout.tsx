import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
  <body className="bg-slate-100 text-slate-900" suppressHydrationWarning>
    {children}
  </body>
</html>
  );
}