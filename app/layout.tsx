import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
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

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable}`}>
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
