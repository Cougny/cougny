'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CreateReportRequest } from '@cougny/protocol';
import { createReport, ensureSession } from '@/lib/api';
import { SpinnerIcon } from '@/components/icons';

type ReportReason = CreateReportRequest['reason'];

const REASONS: { value: ReportReason; labelKey: string }[] = [
  { value: 'nudity', labelKey: 'reasonNudity' },
  { value: 'harassment', labelKey: 'reasonHarassment' },
  { value: 'minor', labelKey: 'reasonMinor' },
  { value: 'spam', labelKey: 'reasonSpam' },
  { value: 'other', labelKey: 'reasonOther' },
];

const DETAILS_MAX_LENGTH = 1000;

interface ReportDialogProps {
  roomId: string;
  peerId: string;
  onClose: () => void;
  /** Called after the report is accepted by the API. */
  onSubmitted: () => void;
}

/** Modal for reporting the current call's peer to moderation. */
export function ReportDialog({
  roomId,
  peerId,
  onClose,
  onSubmitted,
}: ReportDialogProps): React.ReactElement {
  const t = useTranslations('report');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!reason || submitting) return;

    setSubmitting(true);
    setFailed(false);
    void (async () => {
      try {
        const session = await ensureSession();
        await createReport(session.token, {
          roomId,
          reportedPeerId: peerId,
          reason,
          details: details.trim() ? details.trim() : undefined,
        });
        onSubmitted();
      } catch {
        setFailed(true);
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm" onClick={onClose} />

      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        onSubmit={handleSubmit}
        className="relative w-full max-w-md space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
      >
        <h2 id="report-dialog-title" className="text-lg font-semibold text-neutral-100">
          {t('title')}
        </h2>

        <fieldset className="space-y-1.5" disabled={submitting}>
          {REASONS.map(({ value, labelKey }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
                reason === value
                  ? 'border-brand bg-brand/15 text-neutral-100'
                  : 'border-neutral-800 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="h-4 w-4 accent-brand"
              />
              {t(labelKey)}
            </label>
          ))}
        </fieldset>

        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder={t('detailsPlaceholder')}
          maxLength={DETAILS_MAX_LENGTH}
          rows={3}
          disabled={submitting}
          className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 transition placeholder:text-neutral-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-40"
        />

        {failed && (
          <p role="alert" className="text-sm text-red-400">
            {t('error')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full px-5 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-neutral-800 disabled:opacity-40"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={!reason || submitting}
            className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
          >
            {submitting && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            {t('submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
