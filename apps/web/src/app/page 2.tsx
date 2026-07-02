import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function HomePage(): React.ReactElement {
  const t = useTranslations('home');
  const tApp = useTranslations('app');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-brand">{tApp('name')}</p>
        <h1 className="text-4xl font-bold sm:text-5xl">{t('title')}</h1>
        <p className="text-lg text-neutral-400">{t('subtitle')}</p>
      </div>

      <Link
        href="/call"
        className="rounded-full bg-brand px-8 py-3 text-lg font-semibold text-brand-fg transition hover:opacity-90"
      >
        {t('start')}
      </Link>

      <div className="space-y-2 text-sm text-neutral-500">
        <p>{t('cameraNote')}</p>
        <p>{t('guidelines')}</p>
      </div>
    </main>
  );
}
