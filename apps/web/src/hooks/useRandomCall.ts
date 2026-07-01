'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignalPayload } from '@cougny/protocol';
import { ensureSession, fetchIceServers } from '@/lib/api';
import { SignalingClient } from '@/lib/signaling';

export type CallStatus =
  'idle' | 'requesting-media' | 'searching' | 'connecting' | 'connected' | 'peer-left' | 'error';

export interface UseRandomCall {
  status: CallStatus;
  error: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  roomId: string | null;
  peerId: string | null;
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

  const signalingRef = useRef<SignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([]);

  // Perfect-negotiation bookkeeping.
  const politeRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);

  const teardownPeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStream(null);
    setRoomId(null);
    setPeerId(null);
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
  }, []);

  const stop = useCallback(() => {
    teardownPeer();
    signalingRef.current?.close();
    signalingRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setStatus('idle');
  }, [teardownPeer]);

  const createPeerConnection = useCallback((peerIsPolite: boolean) => {
    const signaling = signalingRef.current;
    const localMedia = localStreamRef.current;
    if (!signaling || !localMedia) return null;

    politeRef.current = peerIsPolite;
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pcRef.current = pc;

    for (const track of localMedia.getTracks()) pc.addTrack(track, localMedia);

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

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          setStatus('connected');
          break;
        case 'failed':
        case 'closed':
          setStatus('peer-left');
          break;
      }
    };

    return pc;
  }, []);

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
        signaling.send({ t: 'queue.join', payload: {} });
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
    signaling.send({ t: 'queue.join', payload: {} });
  }, [start, teardownPeer]);

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
    start,
    next,
    stop,
    toggleCamera,
    toggleMic,
  };
}
