import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/common/ThemeProvider";
import { ThemeSwitcherModal } from "@/components/common/ThemeSwitcherModal";
import { ThemeFloatingButton } from "@/components/common/ThemeFloatingButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BOOSTERA — ERP & CRM SaaS Agence Digitale",
  description: "Plateforme unifiée ERP, CRM, Production, Finance & RH pour BOOSTERA",
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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      data-theme="blue"
      suppressHydrationWarning
    >
      <head>
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
      <body className="min-h-full bg-neutral-950 text-neutral-100 font-sans theme-transition">
        <ThemeProvider>
          <ThemeSwitcherModal />
          <ThemeFloatingButton />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

