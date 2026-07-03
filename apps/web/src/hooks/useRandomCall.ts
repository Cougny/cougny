'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchPreferences, SignalPayload } from '@cougny/protocol';
import { ensureSession, fetchIceServers } from '@/lib/api';
import { SignalingClient } from '@/lib/signaling';

export type CallStatus =
  | 'idle'
  | 'requesting-media'
  | 'searching'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'peer-left'
  | 'error';

export interface ChatMessage {
  id: string;
  from: 'me' | 'peer';
  text: string;
  at: number;
}

export interface UseRandomCall {
  status: CallStatus;
  error: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  roomId: string | null;
  peerId: string | null;
  chatMessages: ChatMessage[];
  chatReady: boolean;
  peerTyping: boolean;
  sendChatMessage: (text: string) => void;
  sendTyping: () => void;
  updatePreferences: (preferences: MatchPreferences) => void;
  start: () => void;
  next: () => void;
  stop: () => void;
  toggleCamera: () => void;
  toggleMic: () => void;
}

const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: { echoCancellation: true, noiseSuppression: true },
};

// Both peers open the channel with the same negotiated id, so neither side
// has to wait for an `ondatachannel` event and no extra offer is needed.
const CHAT_CHANNEL_ID = 0;
const CHAT_MESSAGE_MAX_LENGTH = 2000;
const TYPING_SEND_INTERVAL_MS = 1500;
const TYPING_EXPIRY_MS = 3000;

// How long a dropped ICE connection may try to recover (including one ICE
// restart) before the call is declared over.
const RECONNECT_GRACE_MS = 15_000;

/** Frames exchanged over the chat data channel. */
type ChatFrame = { t: 'text'; text: string } | { t: 'typing' };

function parseChatFrame(data: unknown): ChatFrame | null {
  if (typeof data !== 'string') return null;
  try {
    const frame = JSON.parse(data) as ChatFrame;
    if (frame.t === 'typing') return frame;
    if (frame.t === 'text' && typeof frame.text === 'string') return frame;
    return null;
  } catch {
    return null;
  }
}

/**
 * Orchestrates a random 1:1 video call: media capture, signaling, and the
 * WebRTC peer connection. Uses the "perfect negotiation" pattern so either side
 * can (re)negotiate without glare, with the server-assigned `polite` role
 * breaking offer collisions.
 */
export function useRandomCall(): UseRandomCall {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const signalingRef = useRef<SignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chatChannelRef = useRef<RTCDataChannel | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const preferencesRef = useRef<MatchPreferences>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);

  // Perfect-negotiation bookkeeping.
  const politeRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);

  // Reconnection bookkeeping: one ICE restart per drop, bounded by a deadline.
  const iceRestartedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const teardownPeer = useCallback(() => {
    chatChannelRef.current?.close();
    chatChannelRef.current = null;
    if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
    peerTypingTimerRef.current = null;
    lastTypingSentAtRef.current = 0;
    setChatMessages([]);
    setChatReady(false);
    setPeerTyping(false);
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStream(null);
    setRoomId(null);
    setPeerId(null);
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    iceRestartedRef.current = false;
    clearReconnectTimer();
  }, [clearReconnectTimer]);

  const stop = useCallback(() => {
    teardownPeer();
    signalingRef.current?.close();
    signalingRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setStatus('idle');
  }, [teardownPeer]);

  const createPeerConnection = useCallback(
    (peerIsPolite: boolean) => {
      const signaling = signalingRef.current;
      const localMedia = localStreamRef.current;
      if (!signaling || !localMedia) return null;

      politeRef.current = peerIsPolite;
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      pcRef.current = pc;

      for (const track of localMedia.getTracks()) pc.addTrack(track, localMedia);

      const chatChannel = pc.createDataChannel('chat', {
        negotiated: true,
        id: CHAT_CHANNEL_ID,
      });
      chatChannelRef.current = chatChannel;
      chatChannel.onopen = () => setChatReady(true);
      chatChannel.onclose = () => setChatReady(false);
      chatChannel.onmessage = ({ data }) => {
        const frame = parseChatFrame(data);
        if (!frame) return;

        if (frame.t === 'typing') {
          setPeerTyping(true);
          if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
          peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), TYPING_EXPIRY_MS);
          return;
        }

        const text = frame.text.slice(0, CHAT_MESSAGE_MAX_LENGTH).trim();
        if (!text) return;
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        setPeerTyping(false);
        setChatMessages((messages) => [
          ...messages,
          { id: crypto.randomUUID(), from: 'peer', text, at: Date.now() },
        ]);
      };

      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current = true;
          await pc.setLocalDescription();
          const local = pc.localDescription;
          if (local) {
            signaling.send({
              t: 'signal',
              payload: { kind: 'sdp', description: { type: local.type, sdp: local.sdp } },
            });
          }
        } catch {
          setError('errorGeneric');
        } finally {
          makingOfferRef.current = false;
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        signaling.send({
          t: 'signal',
          payload: {
            kind: 'ice',
            candidate: candidate
              ? {
                  candidate: candidate.candidate,
                  sdpMid: candidate.sdpMid,
                  sdpMLineIndex: candidate.sdpMLineIndex,
                  usernameFragment: candidate.usernameFragment,
                }
              : null,
          },
        });
      };

      pc.ontrack = ({ streams }) => {
        if (streams[0]) setRemoteStream(streams[0]);
      };

      // Transient drops get a grace period (and one ICE restart) before the
      // call is declared over — switching networks shouldn't end the chat.
      const enterReconnecting = (): void => {
        setStatus('reconnecting');
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            teardownPeer();
            setStatus('peer-left');
          }, RECONNECT_GRACE_MS);
        }
      };

      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case 'connected':
            clearReconnectTimer();
            iceRestartedRef.current = false;
            setStatus('connected');
            break;
          case 'disconnected':
            enterReconnecting();
            break;
          case 'failed':
            if (!iceRestartedRef.current) {
              iceRestartedRef.current = true;
              pc.restartIce();
              enterReconnecting();
            } else {
              teardownPeer();
              setStatus('peer-left');
            }
            break;
          case 'closed':
            setStatus('peer-left');
            break;
        }
      };

      return pc;
    },
    [clearReconnectTimer, teardownPeer],
  );

  const handleSignal = useCallback(async (payload: SignalPayload) => {
    const pc = pcRef.current;
    const signaling = signalingRef.current;
    if (!pc || !signaling) return;

    try {
      if (payload.kind === 'sdp') {
        const description = payload.description;
        const offerCollision =
          description.type === 'offer' &&
          (makingOfferRef.current || pc.signalingState !== 'stable');
        ignoreOfferRef.current = !politeRef.current && offerCollision;
        if (ignoreOfferRef.current) return;

        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          const answer = pc.localDescription;
          if (answer) {
            signaling.send({
              t: 'signal',
              payload: { kind: 'sdp', description: { type: answer.type, sdp: answer.sdp } },
            });
          }
        }
      } else {
        try {
          await pc.addIceCandidate(payload.candidate ?? undefined);
        } catch (err) {
          if (!ignoreOfferRef.current) throw err;
        }
      }
    } catch {
      setError('errorGeneric');
    }
  }, []);

  const start = useCallback(() => {
    setError(null);
    setStatus('requesting-media');

    void (async () => {
      try {
        const media =
          localStreamRef.current ?? (await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS));
        localStreamRef.current = media;
        setLocalStream(media);

        const session = await ensureSession();
        const ice = await fetchIceServers(session.token);
        iceServersRef.current = ice.iceServers as RTCIceServer[];

        const signaling = new SignalingClient();
        signalingRef.current = signaling;

        signaling.onMessage((message) => {
          switch (message.t) {
            case 'queued':
              setStatus('searching');
              break;
            case 'matched':
              setRoomId(message.payload.roomId);
              setPeerId(message.payload.peerId);
              setStatus('connecting');
              createPeerConnection(message.payload.polite);
              break;
            case 'signal':
              void handleSignal(message.payload);
              break;
            case 'peer.left':
              teardownPeer();
              setStatus('peer-left');
              break;
            case 'error':
              setError('errorGeneric');
              break;
          }
        });

        await signaling.connect(session.token);
        setStatus('searching');
        signaling.send({ t: 'queue.join', payload: preferencesRef.current });
      } catch (err) {
        const denied = err instanceof DOMException && err.name === 'NotAllowedError';
        setError(denied ? 'permissionDenied' : 'errorGeneric');
        setStatus('error');
      }
    })();
  }, [createPeerConnection, handleSignal, teardownPeer]);

  const next = useCallback(() => {
    const signaling = signalingRef.current;
    if (!signaling) {
      start();
      return;
    }
    teardownPeer();
    signaling.send({ t: 'peer.leave' });
    setStatus('searching');
    signaling.send({ t: 'queue.join', payload: preferencesRef.current });
  }, [start, teardownPeer]);

  const updatePreferences = useCallback((preferences: MatchPreferences) => {
    preferencesRef.current = preferences;
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    const channel = chatChannelRef.current;
    const trimmed = text.slice(0, CHAT_MESSAGE_MAX_LENGTH).trim();
    if (!trimmed || channel?.readyState !== 'open') return;
    channel.send(JSON.stringify({ t: 'text', text: trimmed } satisfies ChatFrame));
    lastTypingSentAtRef.current = 0;
    setChatMessages((messages) => [
      ...messages,
      { id: crypto.randomUUID(), from: 'me', text: trimmed, at: Date.now() },
    ]);
  }, []);

  const sendTyping = useCallback(() => {
    const channel = chatChannelRef.current;
    if (channel?.readyState !== 'open') return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < TYPING_SEND_INTERVAL_MS) return;
    lastTypingSentAtRef.current = now;
    channel.send(JSON.stringify({ t: 'typing' } satisfies ChatFrame));
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraEnabled(track.enabled);
  }, []);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicEnabled(track.enabled);
  }, []);

  // Clean up media and sockets if the component unmounts mid-call.
  useEffect(() => stop, [stop]);

  return {
    status,
    error,
    localStream,
    remoteStream,
    cameraEnabled,
    micEnabled,
    roomId,
    peerId,
    chatMessages,
    chatReady,
    peerTyping,
    sendChatMessage,
    sendTyping,
    updatePreferences,
    start,
    next,
    stop,
    toggleCamera,
    toggleMic,
  };
}
