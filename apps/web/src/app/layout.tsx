import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Cougny',
  description: 'Meet someone new, face to face.',
};

/*
 * Applies the persisted theme before first paint so a dark-mode user never
 * sees a white flash. Light is the default; only an explicit 'dark' choice
 * adds the class.
 */
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('cougny.theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`;

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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
