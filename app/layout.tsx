import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { Agentation } from 'agentation';

export const metadata: Metadata = {
  title: 'Soleo — User Research Platform',
  description: 'Run surveys and prototype tests in one session.',
};

export const viewport: Viewport = {
  maximumScale: 1,
};

// Inter kept as fallback (Satoshi Variable is loaded from Fontshare CDN — see <head> below)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${geistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-[100dvh] bg-background text-foreground antialiased">
        <SWRConfig
          value={{
            fallback: {
              '/api/user': getUser(),
              '/api/team': getTeamForUser(),
            },
          }}
        >
          {children}
        </SWRConfig>
        {process.env.NODE_ENV === 'development' && <Agentation />}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            classNames: {
              toast: 'bg-surface border border-border text-foreground text-sm',
              success: 'border-success/30',
              error: 'border-destructive/30',
            },
          }}
        />
      </body>
    </html>
  );
}
