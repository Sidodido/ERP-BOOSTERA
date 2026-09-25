import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { ThemeSwitcherModal } from "@/components/common/ThemeSwitcherModal";
import { ThemeFloatingButton } from "@/components/common/ThemeFloatingButton";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BOOSTERA ERP — ERP & CRM SaaS Agence Digitale",
  description: "Plateforme unifiée ERP, CRM, Production, Finance & RH pour BOOSTERA",
  applicationName: "BOOSTERA ERP",
  appleWebApp: {
    capable: true,
    title: "BOOSTERA ERP",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080b11",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${plusJakartaSans.variable} ${geistSans.variable} ${geistMono.variable} dark h-full antialiased font-sans`}
      data-theme="blue"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('boostera-theme') || 'blue';
                  var lightThemes = ['clean-light', 'pearl-light', 'sage-light', 'lavender-light'];
                  var isLight = lightThemes.indexOf(saved) !== -1;
                  document.documentElement.setAttribute('data-theme', saved);
                  document.documentElement.setAttribute('data-theme-mode', isLight ? 'light' : 'dark');
                  if (isLight) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-[#080c14] text-neutral-100 font-sans theme-transition relative overflow-x-hidden">
        {/* Subtle Ambient Mesh Aura Glows */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-blue-600/[0.12] via-indigo-600/[0.06] to-transparent rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-[35%] -right-32 w-[380px] h-[380px] bg-purple-600/[0.05] rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-[10%] w-[500px] h-[300px] bg-blue-500/[0.04] rounded-full blur-[100px] pointer-events-none" />
        </div>

        <ThemeProvider>
          <div className="relative z-10">
            <ThemeSwitcherModal />
            <ThemeFloatingButton />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

