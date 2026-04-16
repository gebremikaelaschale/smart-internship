import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/common/Modal';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import useAuth from '@/hooks/useAuth';
import { messagingAPI } from '../messagingAPI';
import { io } from 'socket.io-client';

const ROLE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'student', label: 'Students' },
  { value: 'employer', label: 'Industry Partners' },
  { value: 'admin', label: 'Admins' }
];

const CHAT_THEMES = {
  modern: {
    shell: 'bg-slate-50',
    feed: 'bg-slate-50 border-slate-200',
    mine: 'bg-brand-600 text-white',
    theirs: 'bg-white text-slate-900 border border-slate-200'
  },
  ocean: {
    shell: 'bg-cyan-50',
    feed: 'bg-gradient-to-b from-cyan-50 to-blue-50 border-cyan-200',
    mine: 'bg-cyan-700 text-white',
    theirs: 'bg-white text-slate-900 border border-cyan-200'
  },
  sunset: {
    shell: 'bg-rose-50',
    feed: 'bg-gradient-to-b from-rose-50 to-amber-50 border-rose-200',
    mine: 'bg-rose-600 text-white',
    theirs: 'bg-white text-slate-900 border border-rose-200'
  }
};

const FONT_SIZES = {
  sm: '0.9rem',
  md: '1rem',
  lg: '1.1rem'
};

const ZOOMS = [75, 90, 100, 115, 130];
const QUICK_REACTIONS = ['👍', '❤️', '🔥', '👏', '🎯', '✅', '😂', '😮'];

function roleBadge(role) {
  const value = String(role || '').toLowerCase();
  if (value === 'student') return 'bg-cyan-100 text-cyan-700';
  if (value === 'employer') return 'bg-violet-100 text-violet-700';
  return 'bg-amber-100 text-amber-700';
}

function formatTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function makeCallId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildSocketBaseUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
  if (apiBase.startsWith('http')) {
    try {
      const url = new URL(apiBase);
      return `${url.protocol}//${url.host}`;
    } catch {
      return window.location.origin;
    }
  }
  return window.location.origin;
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

export default function Messages() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [viewMode, setViewMode] = useState('direct');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [uiTheme, setUiTheme] = useState(() => localStorage.getItem('chat_theme') || 'modern');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('chat_font_size') || 'md');
  const [zoom, setZoom] = useState(100);
  const [callMode, setCallMode] = useState('');
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [incomingCallLabel, setIncomingCallLabel] = useState('');
  const [outputMuted, setOutputMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [actionMenu, setActionMenu] = useState({ open: false, x: 0, y: 0, message: null });
  const [actionDialog, setActionDialog] = useState({ type: '', message: null });
  const [editDraft, setEditDraft] = useState('');
  const [forwardType, setForwardType] = useState('user');
  const [forwardTargetId, setForwardTargetId] = useState('');
  const [reactionEmoji, setReactionEmoji] = useState('👍');
  const [callHistory, setCallHistory] = useState([]);
  const [showComposer, setShowComposer] = useState(true);
  const [roomAdminBusyId, setRoomAdminBusyId] = useState('');
  const [typingState, setTypingState] = useState({});
  const [fullscreenVideo, setFullscreenVideo] = useState(false);
  const [roomDraft, setRoomDraft] = useState({ name: '', type: 'group' });
  const [roomMembersDraft, setRoomMembersDraft] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callIdRef = useRef('');
  const processedMessageIdsRef = useRef(new Set());
  const searchTimeoutRef = useRef(null);
  const selectedContactRef = useRef(null);
  const selectedRoomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const socketRef = useRef(null);
  const composerRef = useRef(null);
  const actionMenuRef = useRef(null);

  const myId = String(auth?.user?.id || auth?.user?._id || '');
  const selectedContactId = String(selectedContact?.id || '');
  const selectedRoomId = String(selectedRoom?.id || '');
  const activeTheme = CHAT_THEMES[uiTheme] || CHAT_THEMES.modern;
  const currentFontSize = FONT_SIZES[fontSize] || FONT_SIZES.md;

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  useEffect(() => {
    localStorage.setItem('chat_theme', uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    localStorage.setItem('chat_font_size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    if (!auth?.isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [auth?.isAuthenticated, navigate]);

  useEffect(() => {
    const socketInstance = io(buildSocketBaseUrl(), {
      transports: ['websocket'],
      auth: { token: auth?.token }
    });
    setSocket(socketInstance);
    socketRef.current = socketInstance;

    socketInstance.on('message:new', (message) => {
      const currentDirect = selectedContactRef.current;
      const currentRoom = selectedRoomRef.current;
      const isDirect = String(message?.conversationType || 'direct') === 'direct';
      const matchesDirect = isDirect && currentDirect && String(message?.senderId?._id || message?.senderId) === String(currentDirect.id);
      const matchesRoom = !isDirect && currentRoom && String(message?.roomId || '') === String(currentRoom.id);

      if (matchesDirect || matchesRoom) {
        setMessages((prev) => [...prev, message]);
      }
      refreshLists();
    });

    socketInstance.on('message:updated', (message) => {
      setMessages((prev) => prev.map((item) => (String(item._id) === String(message._id) ? message : item)));
    });

    socketInstance.on('message:deleted', (payload) => {
      if (payload?.message?._id) {
        setMessages((prev) => prev.map((item) => (String(item._id) === String(payload.message._id) ? payload.message : item)));
      }
    });

    socketInstance.on('chat:typing', (payload) => {
      const key = payload.roomId ? `room:${payload.roomId}` : `user:${payload.fromUserId}`;
      setTypingState((prev) => ({
        ...prev,
        [key]: { isTyping: Boolean(payload.isTyping), fromUserId: payload.fromUserId, timestamp: Date.now() }
      }));
    });

    socketInstance.on('chat:seen', () => {
      refreshLists();
    });

    socketInstance.on('presence:update', () => {});

    socketInstance.on('call:ringing', async (payload) => {
      if (payload?.mode) {
        setIncomingCallLabel('Incoming ' + payload.mode + ' call...');
      }
    });

    socketInstance.on('call:signal', async (payload) => {
      if (payload?.toUserId && String(payload.toUserId) !== String(myId)) return;
      if (payload?.signalType === 'offer') {
        await acceptIncomingCall({
          callId: payload.callId,
          callMedia: payload.mode,
          signalData: payload.signalData
        });
      } else if (payload?.signalType === 'answer' && peerRef.current) {
        try {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.signalData));
        } catch {}
      } else if (payload?.signalType === 'candidate' && peerRef.current) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.signalData));
        } catch {}
      } else if (payload?.signalType === 'hangup') {
        stopCall(false);
      }
    });

    socketInstance.on('call:state', (payload) => {
      if (payload?.state) {
        setCallStatus(`Call ${payload.state}`);
      }
    });

    return () => {
      socketInstance.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.muted = outputMuted;
    if (remoteVideoRef.current) remoteVideoRef.current.muted = outputMuted;
  }, [outputMuted]);

  useEffect(() => {
    refreshLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  useEffect(() => {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = window.setTimeout(() => {
      refreshLists();
    }, 300);
    return () => searchTimeoutRef.current && window.clearTimeout(searchTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!selectedContactId && !selectedRoomId) return undefined;
    loadHistory();
    const timer = window.setInterval(() => loadHistory(true), 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContactId, selectedRoomId, viewMode]);

  useEffect(() => {
    return () => {
      stopCall(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedContact && composerRef.current) composerRef.current.focus();
  }, [selectedContact, selectedRoom]);

  useEffect(() => {
    if (!actionMenu.open) return undefined;
    const handlePointerDown = (event) => {
      if (actionMenuRef.current?.contains(event.target)) return;
      setActionMenu({ open: false, x: 0, y: 0, message: null });
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [actionMenu.open]);

  const refreshLists = async () => {
    try {
      setLoadingContacts(true);
      setLoadingRooms(true);
      const [contactsRes, roomsRes] = await Promise.all([
        messagingAPI.getContacts({ role: roleFilter, search }),
        messagingAPI.getRooms().catch(() => ({ data: [] }))
      ]);
      const contactItems = Array.isArray(contactsRes.data) ? contactsRes.data : [];
      const roomItems = Array.isArray(roomsRes.data) ? roomsRes.data : [];
      setContacts(contactItems);
      setRooms(roomItems);

      if (selectedContactId) {
        const selectedContactItem = contactItems.find((contact) => String(contact.id) === String(selectedContactId));
        if (selectedContactItem) setSelectedContact(selectedContactItem);
      }
      if (selectedRoomId) {
        const selectedRoomItem = roomItems.find((room) => String(room.id) === String(selectedRoomId));
        if (selectedRoomItem) setSelectedRoom(selectedRoomItem);
      }

      if (!selectedContact && contactItems.length > 0 && viewMode === 'direct') {
        setSelectedContact(contactItems[0]);
      }
      if (!selectedRoom && roomItems.length > 0 && viewMode !== 'direct') {
        setSelectedRoom(roomItems[0]);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load chat data.');
    } finally {
      setLoadingContacts(false);
      setLoadingRooms(false);
    }
  };

  const loadHistory = async (silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      let res = null;
      if (viewMode === 'direct' && selectedContactId) {
        res = await messagingAPI.getDirectHistory(selectedContactId, { limit: 200 });
        await messagingAPI.markDirectSeen(selectedContactId).catch(() => {});
      } else if (viewMode !== 'direct' && selectedRoomId) {
        res = await messagingAPI.getRoomHistory(selectedRoomId, { limit: 200 });
        await messagingAPI.markRoomSeen(selectedRoomId).catch(() => {});
      }
      const items = Array.isArray(res?.data) ? res.data : [];
      setMessages(items);
      processedMessageIdsRef.current = new Set(items.map((item) => String(item._id)));
      if (viewMode === 'direct') {
        setContacts((prev) => prev.map((contact) => String(contact.id) === String(selectedContactId) ? { ...contact, unreadCount: 0 } : contact));
      } else {
        setRooms((prev) => prev.map((room) => String(room.id) === String(selectedRoomId) ? { ...room, unreadCount: 0 } : room));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load messages.');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const selectContact = (contact) => {
    if (!contact) return;
    setViewMode('direct');
    setSelectedContact(contact);
    setSelectedRoom(null);
    setMessages([]);
    setReplyTo(null);
    setError('');
    setStatus('');
  };

  const selectRoom = (room) => {
    if (!room) return;
    setViewMode(room.type || 'group');
    setSelectedRoom(room);
    setSelectedContact(null);
    setMessages([]);
    setReplyTo(null);
    setError('');
    setStatus('');
    socket?.emit?.('chat:joinRoom', { roomId: room.id });
  };

  const createRoom = async (event) => {
    event.preventDefault();
    const name = String(roomDraft.name || '').trim();
    const memberIds = roomMembersDraft.split(',').map((item) => item.trim()).filter(Boolean);
    if (!name) return;
    try {
      const { data } = await messagingAPI.createRoom({ name, type: roomDraft.type, members: memberIds });
      setRoomDraft({ name: '', type: 'group' });
      setRoomMembersDraft('');
      await refreshLists();
      selectRoom({
        id: data._id,
        name: data.name,
        type: data.type,
        members: data.members || []
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to create room.');
    }
  };

  const handleRoomAdminAction = async (memberId, makeAdmin) => {
    if (!selectedRoomId || !memberId) return;
    try {
      setRoomAdminBusyId(String(memberId));
      if (makeAdmin) {
        await messagingAPI.promoteRoomAdmin(selectedRoomId, { memberId });
        setStatus('Member promoted to admin.');
      } else {
        await messagingAPI.demoteRoomAdmin(selectedRoomId, memberId);
        setStatus('Admin demoted to member.');
      }
      await refreshLists();
      setTimeout(() => setStatus(''), 1200);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update room admin role.');
    } finally {
      setRoomAdminBusyId('');
    }
  };

  const emitTyping = (isTyping) => {
    if (!socket) return;
    if (viewMode === 'direct' && selectedContactId) {
      socket.emit('chat:typing', { toUserId: selectedContactId, isTyping });
    } else if (selectedRoomId) {
      socket.emit('chat:typing', { roomId: selectedRoomId, isTyping });
    }
  };

  const handleDraftChange = (event) => {
    setDraft(event.target.value);
    emitTyping(Boolean(event.target.value));
  };

  const handleAttachmentChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Attachment must be smaller than 20MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        url: String(reader.result || '')
      });
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setPendingAttachment(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const startVoiceRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => event.data?.size > 0 && voiceChunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => setPendingAttachment({ name: `voice-note-${Date.now()}.webm`, type: 'audio/webm', size: blob.size, url: String(reader.result || '') });
        reader.readAsDataURL(blob);
        recordingStreamRef.current?.getTracks()?.forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };
      recorder.start();
      setRecordingVoice(true);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start voice recording.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecordingVoice(false);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!canPostInCurrentConversation) {
      setError('This channel is read-only for members. Only channel admins can post.');
      return;
    }
    const content = String(draft || '').trim();
    if (!content && !pendingAttachment) return;
    try {
      setSending(true);
      const payload = {
        content,
        messageType: 'text',
        attachment: pendingAttachment || undefined,
        replyTo: replyTo?._id || undefined
      };
      if (viewMode === 'direct' && selectedContactId) {
        payload.receiverId = selectedContactId;
      } else if (selectedRoomId) {
        payload.roomId = selectedRoomId;
        payload.conversationType = 'group';
      }
      const { data } = await messagingAPI.sendMessage(payload);
      setMessages((prev) => [...prev, data]);
      setDraft('');
      setReplyTo(null);
      setPendingAttachment(null);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      emitTyping(false);
      setStatus('Message sent.');
      setTimeout(() => setStatus(''), 1200);
      refreshLists();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const openActionMenu = (event, message, byContext = false) => {
    event.preventDefault();
    event.stopPropagation();
    const x = byContext ? event.clientX : Math.min(window.innerWidth - 220, event.clientX + 8);
    const y = byContext ? event.clientY : event.clientY + 8;
    setActionMenu({ open: true, x, y, message });
  };

  const closeActionMenu = () => setActionMenu({ open: false, x: 0, y: 0, message: null });

  const openActionDialog = (type, message) => {
    const current = message || actionMenu.message;
    if (!current) return;
    if (type === 'edit') {
      setEditDraft(String(current.content || ''));
    }
    if (type === 'forward') {
      setForwardType(viewMode === 'direct' ? 'room' : 'user');
      setForwardTargetId('');
    }
    if (type === 'react') {
      setReactionEmoji('👍');
    }
    setActionDialog({ type, message: current });
    closeActionMenu();
  };

  const closeActionDialog = () => setActionDialog({ type: '', message: null });

  const handleMessageAction = async (action, options = {}) => {
    const current = options.message || actionMenu.message || actionDialog.message;
    if (!current) return;
    try {
      if (action === 'edit') {
        const nextContent = String(options.content || '').trim();
        if (!nextContent) return;
        const { data } = await messagingAPI.editMessage(current._id, { content: nextContent });
        setMessages((prev) => prev.map((item) => String(item._id) === String(data._id) ? data : item));
        setStatus('Message updated.');
      }
      if (action === 'delete') {
        await messagingAPI.deleteMessage(current._id, true);
        setMessages((prev) => prev.map((item) => String(item._id) === String(current._id) ? { ...item, deletedForEveryone: true, content: 'This message was deleted.' } : item));
        setStatus('Message deleted.');
      }
      if (action === 'reply') {
        setReplyTo(current);
        composerRef.current?.focus();
      }
      if (action === 'forward') {
        const target = String(options.targetId || '').trim();
        const targetType = options.targetType || 'user';
        if (!target) return;
        if (targetType === 'user') {
          await messagingAPI.forwardMessage(current._id, { receiverId: target });
        } else {
          await messagingAPI.forwardMessage(current._id, { roomId: target });
        }
        setStatus('Message forwarded.');
      }
      if (action === 'react') {
        const emoji = String(options.emoji || '').trim();
        if (!emoji) return;
        const { data } = await messagingAPI.reactMessage(current._id, { emoji });
        setMessages((prev) => prev.map((item) => String(item._id) === String(data._id) ? data : item));
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Message action failed.');
    } finally {
      closeActionMenu();
      closeActionDialog();
      setTimeout(() => setStatus(''), 1200);
    }
  };

  const attachLocalStream = async (stream) => {
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    if (localAudioRef.current) localAudioRef.current.srcObject = stream;
  };

  const createPeer = (mode) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peer.onicecandidate = async (event) => {
      if (!event.candidate || !callIdRef.current) return;
      const payload = {
        callId: callIdRef.current,
        messageType: 'signal',
        content: '[candidate]',
        callMedia: mode,
        signalType: 'candidate',
        signalData: event.candidate.toJSON()
      };
      if (viewMode === 'direct' && selectedContactId) payload.receiverId = selectedContactId;
      if (selectedRoomId) payload.roomId = selectedRoomId;
      await messagingAPI.sendMessage(payload).catch(() => {});
      socket?.emit('call:signal', { ...payload, toUserId: selectedContactId || null });
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        if (mode === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
      }
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === 'connected') setCallStatus('Connected');
      if (['failed', 'disconnected', 'closed'].includes(state)) setCallStatus('Call ended');
    };

    peerRef.current = peer;
    return peer;
  };

  const startCall = async (mode) => {
    if (inCall) return;
    const hasTarget = (viewMode === 'direct' && Boolean(selectedContactId)) || (viewMode !== 'direct' && Boolean(selectedRoomId));
    if (!hasTarget) {
      setError(viewMode === 'direct' ? 'Select a contact before starting a call.' : 'Select a room before starting a call.');
      return;
    }
    try {
      setError('');
      setCallStatus(`Starting ${mode} call...`);
      setCallMode(mode);
      setIncomingCallLabel('');
      setOutputMuted(false);
      setMicMuted(false);
      const participants = selectedRoom?.members || (selectedContactId ? [selectedContactId] : []);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });
      await attachLocalStream(stream);
      const peer = createPeer(mode);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      callIdRef.current = makeCallId();
      await messagingAPI.startCallSession({ callId: callIdRef.current, roomId: selectedRoomId || undefined, participantIds: participants, mode });
      socket?.emit('call:join', { callId: callIdRef.current });
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const payload = {
        messageType: 'signal',
        content: '[offer]',
        callId: callIdRef.current,
        callMedia: mode,
        signalType: 'offer',
        signalData: offer
      };
      if (viewMode === 'direct' && selectedContactId) payload.receiverId = selectedContactId;
      if (selectedRoomId) payload.roomId = selectedRoomId;
      await messagingAPI.sendMessage(payload);
      socket?.emit('call:signal', { callId: callIdRef.current, signalType: 'offer', signalData: offer, mode, toUserId: selectedContactId || null });
      setInCall(true);
      setCallStatus('Calling...');
    } catch (requestError) {
      stopCall(false);
      setError(requestError?.response?.data?.message || requestError.message || 'Unable to start call.');
    }
  };

  const acceptIncomingCall = async (signalMessage) => {
    if (!signalMessage || inCall) return;
    try {
      const mode = String(signalMessage.callMedia || 'audio');
      setCallMode(mode);
      setOutputMuted(false);
      setMicMuted(false);
      setInCall(true);
      setCallStatus('Connecting...');
      callIdRef.current = String(signalMessage.callId || makeCallId());
      socket?.emit('call:join', { callId: callIdRef.current });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });
      await attachLocalStream(stream);
      const peer = createPeer(mode);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(new RTCSessionDescription(signalMessage.signalData));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      const payload = {
        messageType: 'signal',
        content: '[answer]',
        callId: callIdRef.current,
        callMedia: mode,
        signalType: 'answer',
        signalData: answer
      };
      if (viewMode === 'direct' && selectedContactId) payload.receiverId = selectedContactId;
      if (selectedRoomId) payload.roomId = selectedRoomId;
      await messagingAPI.sendMessage(payload);
      socket?.emit('call:signal', { callId: callIdRef.current, signalType: 'answer', signalData: answer, mode, toUserId: selectedContactId || null });
      setCallStatus('Connected');
    } catch (requestError) {
      stopCall(false);
      setError(requestError?.response?.data?.message || requestError.message || 'Unable to answer call.');
    }
  };

  const stopCall = async (notifyPeer = true) => {
    try {
      if (notifyPeer && callIdRef.current) {
        const payload = {
          messageType: 'signal',
          content: '[hangup]',
          callId: callIdRef.current,
          callMedia: callMode,
          signalType: 'hangup',
          signalData: { reason: 'ended' }
        };
        if (viewMode === 'direct' && selectedContactId) payload.receiverId = selectedContactId;
        if (selectedRoomId) payload.roomId = selectedRoomId;
        await messagingAPI.sendMessage(payload).catch(() => {});
        socket?.emit('call:signal', { callId: callIdRef.current, signalType: 'hangup', signalData: { reason: 'ended' }, mode: callMode, toUserId: selectedContactId || null });
        await messagingAPI.updateCallState(callIdRef.current, { state: 'ended' }).catch(() => {});
      }
    } finally {
      peerRef.current?.close?.();
      peerRef.current = null;
      localStreamRef.current?.getTracks()?.forEach((track) => track.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      if (localAudioRef.current) localAudioRef.current.srcObject = null;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      callIdRef.current = '';
      setCallMode('');
      setInCall(false);
      setCallStatus('');
      setIncomingCallLabel('');
      setMicMuted(false);
      setOutputMuted(false);
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !micMuted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMicMuted(nextMuted);
  };

  const toggleFullscreen = async () => {
    const element = remoteVideoRef.current || localVideoRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      setFullscreenVideo(false);
    } else {
      await element.parentElement?.requestFullscreen?.().catch(() => {});
      setFullscreenVideo(true);
    }
  };

  const handleDirectTyping = (event) => {
    handleDraftChange(event);
  };

  const conversations = viewMode === 'direct' ? contacts : rooms;
  const selectedTitle = viewMode === 'direct' ? (selectedContact?.name || 'Chat Window') : (selectedRoom?.name || 'Room');
  const selectedSubtitle = viewMode === 'direct'
    ? (selectedContact ? `${selectedContact.email} • ${selectedContact.role}` : 'Pick a person on the left to start chatting.')
    : (selectedRoom ? `${selectedRoom.type} • ${selectedRoom.membersCount || selectedRoom.members?.length || 0} members` : 'Pick a room or create one.');
  const canStartCall = (viewMode === 'direct' && Boolean(selectedContactId)) || (viewMode !== 'direct' && Boolean(selectedRoomId));
  const canPostInCurrentConversation = viewMode === 'direct' || !selectedRoom || selectedRoom.canPost !== false;
  const selectedRoomMembersPreview = selectedRoom?.memberProfiles?.length ? selectedRoom.memberProfiles : (selectedRoom?.members || []).map((memberId) => ({
    id: memberId,
    name: String(memberId).slice(0, 8)
  }));

  const typingKey = viewMode === 'direct' && selectedContactId ? `user:${selectedContactId}` : selectedRoomId ? `room:${selectedRoomId}` : '';
  const typingInfo = typingKey ? typingState[typingKey] : null;

  const forwardUsers = useMemo(() => contacts.filter((contact) => String(contact.id) !== selectedContactId), [contacts, selectedContactId]);
  const forwardRooms = useMemo(() => rooms.filter((room) => String(room.id) !== selectedRoomId), [rooms, selectedRoomId]);
  const canEditOrDeleteSelected = String(actionMenu?.message?.senderId?._id || actionMenu?.message?.senderId || '') === myId;
  const isSelectedRoomOwner = String(selectedRoom?.ownerId || '') === myId;
  const roomAdminIds = useMemo(() => new Set((selectedRoom?.admins || []).map((id) => String(id))), [selectedRoom]);
  const roomMemberNameById = useMemo(() => {
    const map = new Map();
    selectedRoomMembersPreview.forEach((member) => {
      map.set(String(member.id), member.name || String(member.id).slice(0, 8));
    });
    return map;
  }, [selectedRoomMembersPreview]);

  const renderMessage = (message) => {
    const isMine = String(message?.senderId?._id || message?.senderId) === myId;
    const attachment = message?.attachment;
    const isDeleted = Boolean(message?.deletedForEveryone);
    const senderId = String(message?.senderId?._id || message?.senderId || '');
    const seenByIds = Array.isArray(message?.seenBy) ? message.seenBy.map((id) => String(id)) : [];
    const directSeen = isMine && viewMode === 'direct' && (seenByIds.includes(String(selectedContactId)) || Boolean(message?.isRead));
    const roomSeenByOthers = viewMode !== 'direct' && isMine
      ? seenByIds.filter((id) => id !== myId && id !== senderId)
      : [];
    const deliveredByOthers = viewMode !== 'direct' && isMine
      ? (Array.isArray(message?.deliveredTo) ? message.deliveredTo.map((id) => String(id)) : []).filter((id) => id !== myId && id !== senderId)
      : [];

    return (
      <div key={message._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`} onContextMenu={(event) => openActionMenu(event, message, true)}>
        <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? activeTheme.mine : activeTheme.theirs}`}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">{isMine ? 'You' : message?.senderId?.fullName || message?.senderId?.name || 'Contact'}</p>
            <div className="flex items-center gap-2 text-[10px] opacity-70">
              <span>{formatTime(message.createdAt)}</span>
              {message.editedAt ? <span>edited</span> : null}
              {isMine && viewMode === 'direct' ? (directSeen ? <span>✓✓</span> : <span>✓</span>) : null}
            </div>
          </div>

          {message.replyTo ? (
            <div className="mt-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs opacity-90">
              <p className="font-semibold">Replying to</p>
              <p className="truncate">{message.replyTo.content}</p>
            </div>
          ) : null}

          {message.messageType === 'signal' ? (
            <p className="mt-2 text-sm font-semibold">
              {String(message.signalType || 'signal').toUpperCase()} {message.callMedia ? `• ${message.callMedia}` : ''}
            </p>
          ) : !isDeleted ? (
            String(message.content || '').startsWith('[') && attachment ? null : <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
          ) : (
            <p className="mt-2 italic text-sm opacity-80">This message was deleted.</p>
          )}

          {attachment?.url ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/20 bg-white/10">
              {String(attachment.type || '').startsWith('image/') ? (
                <img src={attachment.url} alt={attachment.name || 'attachment'} className="max-h-72 w-full object-cover" />
              ) : String(attachment.type || '').startsWith('video/') ? (
                <video src={attachment.url} controls className="w-full max-h-72 bg-black" />
              ) : String(attachment.type || '').startsWith('audio/') ? (
                <audio src={attachment.url} controls className="w-full" />
              ) : (
                <a href={attachment.url} download={attachment.name || 'attachment'} className="block px-3 py-2 text-sm underline">
                  {attachment.name || 'Download attachment'}
                </a>
              )}
            </div>
          ) : null}

          {message.reactions?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.reactions.map((reaction, index) => (
                <span key={`${message._id}-${reaction.emoji}-${index}`} className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {reaction.emoji}
                </span>
              ))}
            </div>
          ) : null}

          {roomSeenByOthers.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] opacity-85">
              <span className="font-semibold">Seen by</span>
              {roomSeenByOthers.slice(0, 5).map((id) => {
                const name = roomMemberNameById.get(String(id)) || String(id).slice(0, 8);
                return (
                  <span key={`${message._id}-seen-${id}`} title={name} className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[9px] font-semibold">
                    {initials(name)}
                  </span>
                );
              })}
              {roomSeenByOthers.length > 5 ? <span>+{roomSeenByOthers.length - 5}</span> : null}
            </div>
          ) : null}

          {viewMode !== 'direct' && isMine ? (
            <div className="mt-1 flex items-center gap-2 text-[10px] opacity-75">
              <span>Delivered: {deliveredByOthers.length}</span>
              <span>Seen: {roomSeenByOthers.length}</span>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] opacity-90">
            <button type="button" onClick={() => setReplyTo(message)} className="rounded-full bg-white/10 px-2 py-1">Reply</button>
            <button type="button" onClick={(event) => openActionMenu(event, message)} className="rounded-full bg-white/10 px-2 py-1">More</button>
            <button type="button" onClick={() => openActionDialog('react', message)} className="rounded-full bg-white/10 px-2 py-1">React</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`grid gap-6 xl:grid-cols-[340px_1fr] ${activeTheme.shell}`} style={{ fontSize: currentFontSize, transform: `scale(${zoom / 100})`, transformOrigin: 'top center', width: `${100 / (zoom / 100)}%` }}>
      <Card title="Messages" description="Telegram-style enterprise messaging for students, industry partners, admins, rooms, and channels.">
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setViewMode('direct')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewMode === 'direct' ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Direct</button>
          <button type="button" onClick={() => setViewMode('group')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewMode !== 'direct' ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Rooms</button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {ROLE_FILTERS.map((filter) => (
            <button key={filter.value} type="button" onClick={() => setRoleFilter(filter.value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${roleFilter === filter.value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>
              {filter.label}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search people or rooms..."
          className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />

        <form onSubmit={createRoom} className="mb-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Create room/channel</p>
          <input value={roomDraft.name} onChange={(e) => setRoomDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Room name" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={roomDraft.type} onChange={(e) => setRoomDraft((prev) => ({ ...prev, type: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="group">Group</option>
              <option value="channel">Channel</option>
            </select>
            <input value={roomMembersDraft} onChange={(e) => setRoomMembersDraft(e.target.value)} placeholder="Member IDs, comma separated" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <Button type="submit" size="sm" className="w-full border border-slate-900 bg-slate-900 text-white">Create</Button>
        </form>

        <div className="space-y-2 max-h-[64vh] overflow-y-auto pr-1">
          {viewMode === 'direct' ? contacts.map((contact) => (
            <button key={contact.id} type="button" onClick={() => selectContact(contact)} className={`w-full rounded-2xl border p-3 text-left transition ${String(selectedContactId) === String(contact.id) ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{contact.name}</p>
                  <p className="text-xs text-slate-500">{contact.email}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${roleBadge(contact.role)}`}>{contact.role}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{contact.department || contact.college || 'General'}</span>
                <span>{contact.unreadCount > 0 ? `${contact.unreadCount} unread` : formatDate(contact?.lastMessage?.createdAt)}</span>
              </div>
              {contact.lastMessage ? <p className="mt-2 truncate text-xs text-slate-600">{contact.lastMessage.messageType === 'text' ? contact.lastMessage.content : `${contact.lastMessage.signalType || 'signal'} message`}</p> : null}
            </button>
          )) : rooms.map((room) => (
            <button key={room.id} type="button" onClick={() => selectRoom(room)} className={`w-full rounded-2xl border p-3 text-left transition ${String(selectedRoomId) === String(room.id) ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{room.name}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-[0.12em]">{room.type}</p>
                </div>
                <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">{room.membersCount || room.members?.length || 0}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{room.isMuted ? 'Muted' : 'Active'}</span>
                <span>{room.unreadCount > 0 ? `${room.unreadCount} unread` : formatDate(room?.lastMessage?.createdAt)}</span>
              </div>
            </button>
          ))}
          {!loadingContacts && !loadingRooms && conversations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No conversations found.</p> : null}
        </div>
      </Card>

      <Card title={selectedTitle} description={selectedSubtitle}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Theme</span>
          {Object.keys(CHAT_THEMES).map((key) => (
            <button key={key} type="button" onClick={() => setUiTheme(key)} className={`rounded-full px-3 py-1 text-xs font-semibold ${uiTheme === key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{key}</button>
          ))}
          <span className="ml-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Font</span>
          {Object.keys(FONT_SIZES).map((key) => (
            <button key={key} type="button" onClick={() => setFontSize(key)} className={`rounded-full px-3 py-1 text-xs font-semibold ${fontSize === key ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{key.toUpperCase()}</button>
          ))}
          <span className="ml-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Zoom</span>
          {ZOOMS.map((item) => (
            <button key={item} type="button" onClick={() => setZoom(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${zoom === item ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{item}%</button>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={toggleFullscreen}>{fullscreenVideo ? 'Exit Fullscreen' : 'Fullscreen Video'}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowComposer((prev) => !prev)}>{showComposer ? 'Hide Composer' : 'Show Composer'}</Button>
        </div>

        {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {status ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</p> : null}
        {incomingCallLabel ? <p className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-700">{incomingCallLabel}</p> : null}
        {typingInfo?.isTyping ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Typing...</p> : null}

        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedTitle}</p>
                <p className="text-xs text-slate-500">{selectedSubtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => startCall('audio')} disabled={inCall || !canStartCall}>Audio Call</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => startCall('video')} disabled={inCall || !canStartCall}>Video Call</Button>
                {viewMode !== 'direct' ? <Button type="button" size="sm" variant="outline" onClick={() => startCall('video')} disabled={inCall || !canStartCall}>Group Conference</Button> : null}
                {inCall ? <Button type="button" size="sm" variant="outline" onClick={toggleMic}>{micMuted ? 'Unmute Mic' : 'Mute Mic'}</Button> : null}
                {inCall ? <Button type="button" size="sm" variant="outline" onClick={() => setOutputMuted((prev) => !prev)}>{outputMuted ? 'Unmute Sound' : 'Mute Sound'}</Button> : null}
                {inCall ? <Button type="button" size="sm" variant="secondary" onClick={() => stopCall(true)}>End Call</Button> : null}
              </div>
            </div>
            {callStatus ? <p className="text-xs font-semibold text-brand-700">{callStatus}</p> : null}
            {viewMode !== 'direct' && selectedRoom?.members?.length ? (
              <div className="flex flex-wrap gap-2">
                  {selectedRoomMembersPreview.slice(0, 12).map((member) => (
                    <div key={member.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                      <span>{member.name}</span>
                      {roomAdminIds.has(String(member.id)) ? <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] text-white">ADMIN</span> : null}
                      {isSelectedRoomOwner && String(member.id) !== myId && String(member.id) !== String(selectedRoom?.ownerId || '') ? (
                        roomAdminIds.has(String(member.id)) ? (
                          <button
                            type="button"
                            onClick={() => handleRoomAdminAction(String(member.id), false)}
                            disabled={roomAdminBusyId === String(member.id)}
                            className="rounded-full border border-rose-300 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700 disabled:opacity-50"
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRoomAdminAction(String(member.id), true)}
                            disabled={roomAdminBusyId === String(member.id)}
                            className="rounded-full border border-emerald-300 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 disabled:opacity-50"
                          >
                            Promote
                          </button>
                        )
                      ) : null}
                    </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <video ref={remoteVideoRef} autoPlay playsInline className={`h-40 w-full rounded-xl bg-slate-950 object-cover ${callMode === 'video' ? '' : 'hidden'}`} />
            <video ref={localVideoRef} autoPlay muted playsInline className={`h-40 w-full rounded-xl bg-slate-900 object-cover ${callMode === 'video' ? '' : 'hidden'}`} />
            <audio ref={remoteAudioRef} autoPlay className="hidden" />
            <audio ref={localAudioRef} autoPlay muted className="hidden" />
            {callMode !== 'video' ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">Audio call active controls appear here.</div> : null}
          </div>
        </div>

        <div className={`h-[46vh] space-y-3 overflow-y-auto rounded-2xl border p-4 ${activeTheme.feed}`} style={{ fontSize: currentFontSize }}>
          {loadingMessages ? <p className="text-sm text-slate-500">Loading messages...</p> : null}
          {messages.map(renderMessage)}
          {!loadingMessages && messages.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">No messages yet. Send the first one.</p> : null}
        </div>

        {showComposer ? (
          <form className="mt-4 space-y-3" onSubmit={sendMessage}>
            {replyTo ? (
              <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <div className="min-w-0">
                  <p className="font-semibold">Replying to {replyTo?.senderId?.fullName || replyTo?.senderId?.name || 'message'}</p>
                  <p className="truncate">{replyTo.content}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold hover:bg-amber-100">Cancel</button>
              </div>
            ) : null}

            <textarea
              ref={composerRef}
              value={draft}
              onChange={handleDirectTyping}
              rows={5}
              placeholder={canPostInCurrentConversation ? 'Type a message, reply, forward or send a voice note...' : 'Read-only channel for members'}
              disabled={!canPostInCurrentConversation}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />

            {pendingAttachment ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{pendingAttachment.name}</p>
                  <p className="text-xs text-cyan-700">{pendingAttachment.type || 'attachment'} • {formatBytes(pendingAttachment.size)}</p>
                </div>
                <button type="button" onClick={removeAttachment} className="rounded-full border border-cyan-300 px-3 py-1 text-xs font-semibold hover:bg-cyan-100">Remove</button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <input ref={attachmentInputRef} type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt" onChange={handleAttachmentChange} className="hidden" />
              <Button type="button" variant="outline" onClick={() => attachmentInputRef.current?.click()} disabled={!canPostInCurrentConversation}>Attach File</Button>
              <Button type="button" variant="outline" onClick={recordingVoice ? stopVoiceRecording : startVoiceRecording} disabled={!canPostInCurrentConversation}>{recordingVoice ? 'Stop Voice Note' : 'Record Voice Note'}</Button>
              <Button type="submit" className="border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={sending || !canPostInCurrentConversation}>{sending ? 'Sending...' : 'Send'}</Button>
            </div>
            {!canPostInCurrentConversation ? <p className="text-xs font-semibold text-amber-700">Channel posting is restricted. Ask a channel admin to post announcements.</p> : null}
            {recordingVoice ? <p className="text-xs font-semibold text-rose-600">Recording voice note...</p> : null}
          </form>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card title="Call History" description="Enterprise call audit trail">
            <Button type="button" variant="outline" onClick={async () => setCallHistory((await messagingAPI.getCallHistory()).data || [])}>Refresh Call History</Button>
            <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
              {callHistory.map((item) => (
                <div key={item._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{item.mode} • {item.state}</p>
                  <p className="text-xs text-slate-500">Duration: {item.durationSeconds}s</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Message Actions" description="Right-click a bubble or tap More to open Telegram-style actions">
            <p className="text-sm text-slate-600">Actions are now in-context: Reply, Edit, Forward, React, and Delete appear directly on the selected message.</p>
          </Card>
        </div>

        {actionMenu.open && actionMenu.message ? (
          <div ref={actionMenuRef} className="fixed z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl" style={{ left: `${actionMenu.x}px`, top: `${actionMenu.y}px` }}>
            <button type="button" onClick={() => handleMessageAction('reply', { message: actionMenu.message })} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Reply</button>
            {canEditOrDeleteSelected ? <button type="button" onClick={() => openActionDialog('edit', actionMenu.message)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Edit</button> : null}
            <button type="button" onClick={() => openActionDialog('forward', actionMenu.message)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">Forward</button>
            <div className="my-1 border-t border-slate-200" />
            <div className="px-3 pb-2 pt-1">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">React</p>
              <div className="flex flex-wrap gap-1">
                {QUICK_REACTIONS.slice(0, 6).map((emoji) => (
                  <button key={emoji} type="button" onClick={() => handleMessageAction('react', { message: actionMenu.message, emoji })} className="rounded-md border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50">
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            {canEditOrDeleteSelected ? <div className="my-1 border-t border-slate-200" /> : null}
            {canEditOrDeleteSelected ? <button type="button" onClick={() => handleMessageAction('delete', { message: actionMenu.message })} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">Delete</button> : null}
          </div>
        ) : null}

        <Modal open={actionDialog.type === 'edit'} title="Edit Message" onClose={closeActionDialog}>
          <div className="space-y-3">
            <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeActionDialog}>Cancel</Button>
              <Button type="button" className="border border-slate-900 bg-slate-900 text-white" onClick={() => handleMessageAction('edit', { content: editDraft })}>Save</Button>
            </div>
          </div>
        </Modal>

        <Modal open={actionDialog.type === 'forward'} title="Forward Message" onClose={closeActionDialog}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setForwardType('user'); setForwardTargetId(''); }} className={`rounded-xl border px-3 py-2 text-sm ${forwardType === 'user' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>User</button>
              <button type="button" onClick={() => { setForwardType('room'); setForwardTargetId(''); }} className={`rounded-xl border px-3 py-2 text-sm ${forwardType === 'room' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>Room</button>
            </div>
            <select value={forwardTargetId} onChange={(event) => setForwardTargetId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select destination</option>
              {(forwardType === 'user' ? forwardUsers : forwardRooms).map((item) => (
                <option key={item.id} value={item.id}>{forwardType === 'user' ? `${item.name} (${item.role || 'user'})` : `${item.name} (${item.type || 'room'})`}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeActionDialog}>Cancel</Button>
              <Button type="button" className="border border-slate-900 bg-slate-900 text-white" disabled={!forwardTargetId} onClick={() => handleMessageAction('forward', { targetType: forwardType, targetId: forwardTargetId })}>Forward</Button>
            </div>
          </div>
        </Modal>

        <Modal open={actionDialog.type === 'react'} title="React To Message" onClose={closeActionDialog}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_REACTIONS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => setReactionEmoji(emoji)} className={`rounded-lg border px-3 py-2 text-lg ${reactionEmoji === emoji ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}>
                  {emoji}
                </button>
              ))}
            </div>
            <input value={reactionEmoji} onChange={(event) => setReactionEmoji(event.target.value)} placeholder="Custom emoji" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeActionDialog}>Cancel</Button>
              <Button type="button" className="border border-slate-900 bg-slate-900 text-white" onClick={() => handleMessageAction('react', { emoji: reactionEmoji })}>React</Button>
            </div>
          </div>
        </Modal>
      </Card>
    </div>
  );
}
