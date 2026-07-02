import Link from 'next/link';
import { useTranslations } from 'next-intl';

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
  const tApp = useTranslations('app');

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="pb-10 text-sm font-semibold uppercase tracking-[0.25em] text-neutral-400">
        {tApp('name')}
      </p>

      <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="pt-3 text-sm text-neutral-500">{t('updated')}</p>

      <div className="space-y-8 pt-10">
        {SECTION_KEYS.map((key) => (
          <section key={key}>
            <h2 className="pb-2 text-lg font-semibold text-neutral-100">{t(`${key}Title`)}</h2>
            <p className="leading-relaxed text-neutral-400">{t(`${key}Body`)}</p>
          </section>
        ))}
      </div>

      <Link
        href="/"
        className="mt-12 inline-block rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-900"
      >
        {t('back')}
      </Link>
    </main>
  );
}
