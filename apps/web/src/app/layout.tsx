import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { AccentInit } from '@/components/accent-init';
import './globals.css';

export const metadata: Metadata = {
  title: 'Todoer',
  description: 'Organize your work and life',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AccentInit />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
