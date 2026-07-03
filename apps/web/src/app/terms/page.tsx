import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';

const SECTION_KEYS = [
  'acceptance',
  'eligibility',
  'conduct',
  'privacy',
  'moderation',
  'liability',
  'changes',
] as const;

export default function TermsPage(): React.ReactElement {
  const t = useTranslations('terms');

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="pt-3 text-sm text-neutral-500 dark:text-neutral-400">{t('updated')}</p>

        <div className="space-y-8 pt-10">
          {SECTION_KEYS.map((key) => (
            <section key={key}>
              <h2 className="pb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {t(`${key}Title`)}
              </h2>
              <p className="leading-relaxed text-neutral-600 dark:text-neutral-400">
                {t(`${key}Body`)}
              </p>
            </section>
          ))}
        </div>

        <Link
          href="/"
          className="mt-12 inline-block rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-500 dark:hover:bg-neutral-900"
        >
          {t('back')}
        </Link>
      </main>
    </div>
  );
}
