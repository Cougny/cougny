'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRandomCall, type CallStatus } from '@/hooks/useRandomCall';
import { VideoView } from '@/components/VideoView';
import { ChatPanel } from '@/components/ChatPanel';
import { MatchControls } from '@/components/MatchControls';
import { ReportDialog } from '@/components/ReportDialog';
import {
  CameraIcon,
  CameraOffIcon,
  FlagIcon,
  MicIcon,
  MicOffIcon,
  SpinnerIcon,
  UserIcon,
} from '@/components/icons';

const REPORT_TOAST_MS = 4000;

export default function HomePage(): React.ReactElement {
  const t = useTranslations('call');
  const tReport = useTranslations('report');
  const call = useRandomCall();

  // Snapshot the call identifiers when the dialog opens, so the report still
  // targets the right room even if the peer leaves mid-form.
  const [reportTarget, setReportTarget] = useState<{ roomId: string; peerId: string } | null>(null);
  const [reportThanks, setReportThanks] = useState(false);

  useEffect(() => {
    if (!reportThanks) return;
    const timer = setTimeout(() => setReportThanks(false), REPORT_TOAST_MS);
    return () => clearTimeout(timer);
  }, [reportThanks]);

  const renderStrangerOverlay = (): React.ReactElement => {
    if (call.error) {
      return (
        <div className="space-y-4 px-6 text-center">
          <p className="text-base text-neutral-300">{t(call.error)}</p>
          {call.error === 'permissionDenied' && (
            <button
              onClick={call.start}
              className="rounded-full bg-brand px-6 py-2 font-semibold text-brand-fg transition hover:scale-105 hover:opacity-90 active:scale-95"
            >
              {t('permissionRetry')}
            </button>
          )}
        </div>
      );
    }

    if (call.status === 'idle') {
      return (
        <div className="flex flex-col items-center gap-3 px-6 text-center text-neutral-600">
          <UserIcon className="h-12 w-12" />
          <p className="text-base text-neutral-500">{t('idleHint')}</p>
        </div>
      );
    }

    if (call.status === 'peer-left') {
      return <p className="px-6 text-center text-base text-neutral-400">{t('peerLeft')}</p>;
    }

    return (
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <SpinnerIcon className="h-8 w-8 animate-spin text-brand" />
        <p className="text-base text-neutral-400">{t(statusMessageKey(call.status))}</p>
      </div>
    );
  };

  return (
    <main className="flex h-dvh flex-col bg-neutral-950">
      {/* Video stage: you on the left, the stranger on the right (top ~80%). */}
      <div className="flex min-h-0 flex-[8] gap-2 p-2">
        <VideoPanel label={t('you')} muted={!call.micEnabled} mutedLabel={t('micOffBadge')}>
          {call.localStream && call.cameraEnabled ? (
            <VideoView
              stream={call.localStream}
              muted
              mirrored
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-neutral-600">
              <UserIcon className="h-12 w-12" />
              {call.localStream && !call.cameraEnabled && (
                <p className="text-sm">{t('cameraOffNote')}</p>
              )}
            </div>
          )}

          {/* Media toggles live on the self-view so the bottom strip stays block-only. */}
          {call.localStream && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              <MediaToggle
                enabled={call.micEnabled}
                label={t('toggleMic')}
                onClick={call.toggleMic}
                iconOn={<MicIcon className="h-4 w-4" />}
                iconOff={<MicOffIcon className="h-4 w-4" />}
              />
              <MediaToggle
                enabled={call.cameraEnabled}
                label={t('toggleCamera')}
                onClick={call.toggleCamera}
                iconOn={<CameraIcon className="h-4 w-4" />}
                iconOff={<CameraOffIcon className="h-4 w-4" />}
              />
            </div>
          )}
        </VideoPanel>

        <VideoPanel label={t('stranger')} live={call.status === 'connected'}>
          {call.remoteStream ? (
            <VideoView stream={call.remoteStream} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {renderStrangerOverlay()}
            </div>
          )}

          {call.status === 'connected' && call.roomId && call.peerId && (
            <button
              onClick={() => setReportTarget({ roomId: call.roomId!, peerId: call.peerId! })}
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-neutral-950/70 px-3 py-1.5 text-xs font-medium text-neutral-200 backdrop-blur transition hover:bg-red-600/90 hover:text-white"
            >
              <FlagIcon className="h-3.5 w-3.5" />
              {t('report')}
            </button>
          )}
        </VideoPanel>
      </div>

      {reportTarget && (
        <ReportDialog
          roomId={reportTarget.roomId}
          peerId={reportTarget.peerId}
          onClose={() => setReportTarget(null)}
          onSubmitted={() => {
            setReportTarget(null);
            setReportThanks(true);
            call.next();
          }}
        />
      )}

      {reportThanks && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-100 shadow-2xl"
        >
          {tReport('thanks')}
        </div>
      )}

      {/* Bottom ~20%: controls on the left, chat on the right. */}
      <div className="flex min-h-0 flex-[2] border-t border-neutral-800">
        <div className="w-1/2 min-w-0">
          <MatchControls
            status={call.status}
            onStart={call.start}
            onSkip={call.next}
            onStop={call.stop}
            onPreferencesChange={call.updatePreferences}
          />
        </div>

        <div className="flex w-1/2 min-w-0 flex-col border-l border-neutral-800 bg-neutral-900/40">
          <ChatPanel
            messages={call.chatMessages}
            ready={call.chatReady && call.status === 'connected'}
            peerTyping={call.peerTyping}
            onSend={call.sendChatMessage}
            onTyping={call.sendTyping}
          />
        </div>
      </div>
    </main>
  );
}

function statusMessageKey(status: CallStatus): string {
  switch (status) {
    case 'searching':
      return 'searching';
    case 'reconnecting':
      return 'reconnecting';
    case 'peer-left':
      return 'peerLeft';
    default:
      return 'connecting';
  }
}

function MediaToggle({
  enabled,
  label,
  onClick,
  iconOn,
  iconOff,
}: {
  enabled: boolean;
  label: string;
  onClick: () => void;
  iconOn: React.ReactNode;
  iconOff: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      aria-pressed={!enabled}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition hover:scale-105 active:scale-95 ${
        enabled
          ? 'bg-neutral-950/70 text-neutral-100 hover:bg-neutral-800'
          : 'bg-red-600/90 text-white hover:bg-red-500'
      }`}
    >
      {enabled ? iconOn : iconOff}
    </button>
  );
}

function VideoPanel({
  label,
  live = false,
  muted = false,
  mutedLabel,
  children,
}: {
  label: string;
  live?: boolean;
  muted?: boolean;
  mutedLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="relative flex-1 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
      {children}

      <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-neutral-950/70 px-3 py-1 text-xs font-medium text-neutral-200 backdrop-blur">
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
        {label}
      </span>

      {muted && (
        <span
          title={mutedLabel}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-600/90 text-white backdrop-blur"
        >
          <MicOffIcon className="h-3.5 w-3.5" />
          {mutedLabel && <span className="sr-only">{mutedLabel}</span>}
        </span>
      )}
    </div>
  );
}
