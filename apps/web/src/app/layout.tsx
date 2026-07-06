import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Cougny',
  description: 'Meet someone new, face to face.',
};

/*
 * Applies the theme before first paint:
 * - A stored 'light' or 'dark' choice overrides the OS.
 * - Otherwise the OS-level `prefers-color-scheme` is used.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('cougny.theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const locale = await getLocale();
  const messages = await getMessages();

  // The font variable lives on <html> so the `@theme` token (resolved at
  // :root) can see it.
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} suppressHydrationWarning />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
