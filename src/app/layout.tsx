import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/Header";
import Nav from "@/components/Nav";

export const metadata = { title: "My Accountant App — Auth & Holdings (CRUD)" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <AuthProvider>
          <Header />
          <Nav />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
