'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRandomCall, type CallStatus } from '@/hooks/useRandomCall';
import { VideoView } from '@/components/VideoView';

export default function CallPage(): React.ReactElement {
  const t = useTranslations('call');
  const tHome = useTranslations('home');
  const router = useRouter();
  const call = useRandomCall();

  const handleStop = (): void => {
    call.stop();
    router.push('/');
  };

  const renderOverlay = (): React.ReactElement => {
    if (call.error) {
      return (
        <div className="space-y-4 text-center">
          <p className="text-lg text-neutral-300">{t(call.error)}</p>
          {call.error === 'permissionDenied' && (
            <button
              onClick={call.start}
              className="rounded-full bg-brand px-6 py-2 font-semibold text-brand-fg"
            >
              {t('permissionRetry')}
            </button>
          )}
        </div>
      );
    }

    if (call.status === 'idle') {
      return (
        <button
          onClick={call.start}
          className="rounded-full bg-brand px-8 py-3 text-lg font-semibold text-brand-fg transition hover:opacity-90"
        >
          {tHome('start')}
        </button>
      );
    }

    return (
      <p className="animate-pulse text-lg text-neutral-400">{t(statusMessageKey(call.status))}</p>
    );
  };

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950">
      <div className="relative flex-1">
        {/* Remote peer fills the stage. */}
        <div className="absolute inset-0 flex items-center justify-center">
          {call.remoteStream ? (
            <VideoView stream={call.remoteStream} className="h-full w-full object-cover" />
          ) : (
            renderOverlay()
          )}
        </div>

        {/* Local self-view, picture-in-picture. */}
        <div className="absolute bottom-24 right-4 aspect-video w-40 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg sm:w-56">
          <VideoView
            stream={call.localStream}
            muted
            mirrored
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <Controls
        status={call.status}
        cameraEnabled={call.cameraEnabled}
        micEnabled={call.micEnabled}
        onNext={call.next}
        onStop={handleStop}
        onToggleCamera={call.toggleCamera}
        onToggleMic={call.toggleMic}
      />
    </main>
  );
}

function statusMessageKey(status: CallStatus): string {
  switch (status) {
    case 'searching':
      return 'searching';
    case 'peer-left':
      return 'peerLeft';
    default:
      return 'connecting';
  }
}

function Controls({
  status,
  cameraEnabled,
  micEnabled,
  onNext,
  onStop,
  onToggleCamera,
  onToggleMic,
}: {
  status: CallStatus;
  cameraEnabled: boolean;
  micEnabled: boolean;
  onNext: () => void;
  onStop: () => void;
  onToggleCamera: () => void;
  onToggleMic: () => void;
}): React.ReactElement {
  const t = useTranslations('call');
  const active = status !== 'idle';

  return (
    <div className="flex items-center justify-center gap-3 border-t border-neutral-800 bg-neutral-900/80 p-4 backdrop-blur">
      <button
        onClick={onToggleMic}
        disabled={!active}
        className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium disabled:opacity-40"
        aria-pressed={!micEnabled}
      >
        {t('toggleMic')}
        {micEnabled ? '' : ' ✕'}
      </button>
      <button
        onClick={onToggleCamera}
        disabled={!active}
        className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium disabled:opacity-40"
        aria-pressed={!cameraEnabled}
      >
        {t('toggleCamera')}
        {cameraEnabled ? '' : ' ✕'}
      </button>
      <button
        onClick={onNext}
        disabled={!active}
        className="rounded-full bg-brand px-6 py-2 text-sm font-semibold text-brand-fg disabled:opacity-40"
      >
        {t('next')}
      </button>
      <button
        onClick={onStop}
        className="rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white"
      >
        {t('stop')}
      </button>
    </div>
  );
}
