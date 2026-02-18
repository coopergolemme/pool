import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Navigation } from "../components/Navigation";

const displayFont = Bebas_Neue({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DTD Pool Game Tracker",
  description: "Track pool games, racks, and player stats in one place.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DTD Pool",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c1412",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>
        <div className="flex flex-col h-dvh w-full overflow-hidden">
          {/* Main Content Area - Scrollable */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-20">
            <div className="mx-auto w-full max-w-6xl pb-32 sm:pb-8">
              {children}
            </div>
          </main>

          {/* Persistent Navigation */}
          <Navigation />
          
          <Toaster 
            position="top-center" 
            theme="dark" 
            toastOptions={{
              style: {
                marginTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
                background: "rgba(11,15,14,0.96)",
                color: "#f4f3ee",
                border: "1px solid rgba(202,164,104,0.35)",
              },
            }}
          />
        </div>
      </body>
    </html>
  );
}
