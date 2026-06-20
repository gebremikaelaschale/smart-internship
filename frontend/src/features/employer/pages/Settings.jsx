import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { employerAPI } from '../employerAPI';
import useAuth from '@/hooks/useAuth';
import { authAPI } from '@/features/auth/authAPI';

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-[32px] border border-slate-100 shadow-[0_15px_40px_rgba(15,23,42,0.03)] p-8 ${className}`}>
    {children}
  </div>
);

const Toggle = ({ enabled, onChange, label, loading }) => (
  <div className="flex items-center justify-between py-4">
    <span className="text-sm font-bold text-slate-600">{label}</span>
    <button
      onClick={() => !loading && onChange(!enabled)}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-cyan-500' : 'bg-slate-200'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  </div>
);

const PasswordInput = ({ label, name, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-1">{label}</label>
      <div className="relative group">
        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-cyan-50/50 focus:border-cyan-200 transition-all placeholder:text-slate-300"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 transition-all"
        >
          {show ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default function EmployerSettings() {
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [notifications, setNotifications] = useState({ emailAlerts: true, applicationAlerts: true });
  const [loading, setLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [notifMsg, setNotifMsg] = useState({ type: '', text: '' });
  const [identity, setIdentity] = useState({ logoUrl: '', signatureUrl: '', hasLogo: false, hasSignature: false });
  const [logoFile, setLogoFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityMsg, setIdentityMsg] = useState({ type: '', text: '' });
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const auth = useAuth();

  const getTrimmedCanvas = (canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    let top = height;
    let bottom = 0;
    let left = width;
    let right = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        if (imageData.data[idx + 3] !== 0) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
    }

    if (top === height || left === width) {
      return null;
    }

    const trimmedWidth = right - left + 1;
    const trimmedHeight = bottom - top + 1;
    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedWidth;
    trimmedCanvas.height = trimmedHeight;
    trimmedCanvas.getContext('2d')?.drawImage(canvas, left, top, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
    return trimmedCanvas;
  };

  const dataUrlToFile = (dataUrl, filename) => {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(base64 || '');
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      array[i] = binary.charCodeAt(i);
    }
    return new File([array], filename, { type: mimeType });
  };

  const drawSignaturePoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    if (!drawingRef.current) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawingRef.current = true;
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current = false;
  };

  const saveDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const trimmed = getTrimmedCanvas(canvas);
    if (!trimmed) {
      setIdentityMsg({ type: 'error', text: 'Please draw your signature before saving.' });
      return;
    }
    const signatureUrl = trimmed.toDataURL('image/png');
    setIdentity((prev) => ({ ...prev, signatureUrl, hasSignature: true }));
    setSignatureFile(null);
    setIdentityMsg({ type: 'success', text: 'Captured signature. Save Digital Identity to persist it.' });
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setIdentityMsg({ type: '', text: '' });
    setIdentity((prev) => ({ ...prev, logoUrl: URL.createObjectURL(file) }));
    const reader = new FileReader();
    reader.onload = () => setIdentity((prev) => ({ ...prev, logoUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSignatureFile(file);
    setIdentityMsg({ type: '', text: '' });
    setIdentity((prev) => ({ ...prev, signatureUrl: URL.createObjectURL(file) }));
    const reader = new FileReader();
    reader.onload = () => setIdentity((prev) => ({ ...prev, signatureUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const saveIdentity = async () => {
    if (!logoFile && !identity.logoUrl) {
      setIdentityMsg({ type: 'error', text: 'Company logo and digital signature are mandatory.' });
      return;
    }
    if (!signatureFile && !identity.signatureUrl) {
      setIdentityMsg({ type: 'error', text: 'Company logo and digital signature are mandatory.' });
      return;
    }

    if (identity.logoUrl?.startsWith('blob:')) {
      setIdentityMsg({ type: 'error', text: 'Please wait for the logo preview to finish loading or reselect the logo.' });
      return;
    }
    if (identity.signatureUrl?.startsWith('blob:')) {
      setIdentityMsg({ type: 'error', text: 'Please wait for the signature preview to finish loading or reselect the signature.' });
      return;
    }

    const formData = new FormData();
    if (logoFile) {
      formData.append('logoFile', logoFile);
    } else if (identity.logoUrl) {
      if (identity.logoUrl.startsWith('data:')) {
        formData.append('logoFile', dataUrlToFile(identity.logoUrl, 'logo.png'));
      } else {
        formData.append('logoUrl', identity.logoUrl);
      }
    }

    if (signatureFile) {
      formData.append('signatureFile', signatureFile);
    } else if (identity.signatureUrl) {
      if (identity.signatureUrl.startsWith('data:')) {
        formData.append('signatureFile', dataUrlToFile(identity.signatureUrl, 'signature.png'));
      } else {
        formData.append('signatureDataUrl', identity.signatureUrl);
      }
    }

    setIdentityLoading(true);
    setIdentityMsg({ type: '', text: '' });

    try {
      const { data } = await employerAPI.updateCompanyIdentity(formData);
      setIdentity((prev) => ({
        ...prev,
        ...(data?.identity || {}),
        hasLogo: Boolean(data?.identity?.hasLogo),
        hasSignature: Boolean(data?.identity?.hasSignature)
      }));
      setLogoFile(null);
      setSignatureFile(null);
      setIdentityMsg({ type: 'success', text: 'Digital Identity Saved Successfully!' });
    } catch (err) {
      setIdentityMsg({ type: 'error', text: err?.response?.data?.message || 'Failed to save company identity.' });
    } finally {
      setIdentityLoading(false);
    }
  };

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const response = await api.get('/user-preferences/notifications');
        const prefs = response.data.notifications;
        setNotifications({
          emailAlerts: prefs.emailAlerts ?? true,
          applicationAlerts: prefs.applicationAlerts ?? true
        });
      } catch (err) {
        console.error("Failed to load preferences", err);
      }
    };
    fetchPrefs();
  }, []);

  useEffect(() => {
    const fetchIdentity = async () => {
      try {
        const { data } = await employerAPI.getCompanyIdentity();
        setIdentity({
          logoUrl: data?.logoUrl || '',
          signatureUrl: data?.signatureUrl || '',
          hasLogo: Boolean(data?.hasLogo),
          hasSignature: Boolean(data?.hasSignature)
        });
        setLogoFile(null);
        setSignatureFile(null);
      } catch {
        // Ignore load error; user can still upload.
      }
    };
    fetchIdentity();
  }, []);

  useEffect(() => {
    if (!message.text && !notifMsg.text && !identityMsg.text) return undefined;
    const timer = setTimeout(() => {
      setMessage({ type: '', text: '' });
      setNotifMsg({ type: '', text: '' });
      setIdentityMsg({ type: '', text: '' });
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, notifMsg, identityMsg]);

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    if (message.text) setMessage({ type: '', text: '' });
  };

  const handleNotifToggle = async (key, val) => {
    const newNotifs = { ...notifications, [key]: val };
    setNotifications(newNotifs);
    setNotifLoading(true);
    try {
      await api.put('/user-preferences/notifications', { [key]: val });
    } catch (err) {
      setNotifications(notifications);
    } finally {
      setNotifLoading(false);
    }
  };

  const sendTestEmail = async () => {
    setTestLoading(true);
    setNotifMsg({ type: '', text: '' });
    try {
      const response = await api.post('/user-preferences/test-email');
      setNotifMsg({ type: 'success', text: response.data.message });
    } catch (err) {
      setNotifMsg({ type: 'error', text: err.response?.data?.message || 'Failed to send test email.' });
    } finally {
      setTestLoading(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      setMessage({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setLoading(true);
    try {
      const token = auth?.token || localStorage.getItem('token') || '';
      const { data } = await authAPI.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.new
      }, token);
      setMessage({ type: 'success', text: data?.message || 'Password updated successfully!' });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed.' });
    } finally {
      setLoading(false);
    }
  };

  const [showSecurity, setShowSecurity] = useState(false);
  const [showComm, setShowComm] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-10 pb-20 px-6 lg:px-10">
      <div className="mb-8">
        <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-[40px] p-10 relative overflow-hidden border border-emerald-100/50">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-2">PARTNER PREFERENCES</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Account Settings</h2>
            <p className="text-slate-500 mt-2 font-medium max-w-lg">Configure your security and notification preferences for the industry portal.</p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* 🔒 Account Security Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="overflow-hidden !p-0">
            <button 
              onClick={() => setShowSecurity(!showSecurity)}
              className="w-full flex items-center justify-between p-8 hover:bg-slate-50 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Security Credentials</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage Passwords</p>
                </div>
              </div>
              <div className={`h-8 w-8 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-400 transition-transform ${showSecurity ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </button>

            <AnimatePresence>
              {showSecurity && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-8 pt-0 space-y-6">
                    <form onSubmit={updatePassword} className="space-y-6">
                      <PasswordInput label="Current Password" name="current" value={passwords.current} onChange={handlePasswordChange} placeholder="••••••••" />
                      <PasswordInput label="New Password" name="new" value={passwords.new} onChange={handlePasswordChange} placeholder="••••••••" />
                      <PasswordInput label="Confirm New Password" name="confirm" value={passwords.confirm} onChange={handlePasswordChange} placeholder="••••••••" />

                      <AnimatePresence mode="wait">
                        {message.text && (
                          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className={`p-4 rounded-2xl text-[11px] font-black uppercase tracking-wider flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                            <span>{message.type === 'success' ? '✔' : '✖'}</span>
                            {message.text}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button type="submit" disabled={loading} className="group relative w-full overflow-hidden rounded-2xl bg-slate-900 py-4.5 text-[11px] font-black uppercase tracking-[0.25em] text-white shadow-xl hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-70">
                        <div className="relative z-10 flex items-center justify-center gap-2">
                          {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                          <span>{loading ? 'Processing...' : 'Update Credentials'}</span>
                        </div>
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* 🔔 Notification Preferences Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className="overflow-hidden !p-0">
            <button 
              onClick={() => setShowComm(!showComm)}
              className="w-full flex items-center justify-between p-8 hover:bg-slate-50 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shadow-sm">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Communication 🔔</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Notification Controls</p>
                </div>
              </div>
              <div className={`h-8 w-8 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-400 transition-transform ${showComm ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </button>

            <AnimatePresence>
              {showComm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-8 pt-0 space-y-2">
                    <div className="space-y-2 divide-y divide-slate-50">
                      <Toggle label="Email Notifications for New Applications" enabled={notifications.applicationAlerts} loading={notifLoading} onChange={(val) => handleNotifToggle('applicationAlerts', val)} />
                      <Toggle label="Weekly Logbook Submission Reminders" enabled={notifications.emailAlerts} loading={notifLoading} onChange={(val) => handleNotifToggle('emailAlerts', val)} />
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-50">
                      <button 
                        onClick={sendTestEmail}
                        disabled={testLoading}
                        className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                      >
                        {testLoading ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                        ) : '📧 Dispatch Test Email'}
                      </button>
                      
                      <AnimatePresence>
                        {notifMsg.text && (
                          <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className={`mt-4 text-[10px] font-black uppercase text-center ${notifMsg.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {notifMsg.text}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mt-8">
        <Card>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900">Official Company Identity</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Mandatory for Acceptance and Evaluation forms</p>
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-700">
              {identity.hasLogo && identity.hasSignature ? 'Identity Ready' : 'Identity Incomplete'}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Company Logo Upload</p>
              <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {identity.logoUrl ? <img src={identity.logoUrl} alt="Company Logo" className="h-full w-full object-contain" /> : <span className="text-xs font-bold text-slate-500">No logo uploaded</span>}
              </div>
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleLogoUpload} className="mt-3 block w-full text-xs font-semibold" />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Digital Signature (Upload or Draw)</p>
              <p className="mt-1 text-[10px] font-semibold text-slate-500">Save your signature once here; it will be applied automatically to all official forms and PDFs.</p>
              <div className="mt-3 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                {identity.signatureUrl ? <img src={identity.signatureUrl} alt="Digital Signature" className="h-full w-full object-contain" style={{ backgroundColor: 'transparent' }} /> : <span className="text-xs font-bold text-slate-500">No signature available</span>}
              </div>
              <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleSignatureUpload} className="mt-3 block w-full text-xs font-semibold" />

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={120}
                  onPointerDown={(e) => { e.preventDefault(); drawSignaturePoint(e); }}
                  onPointerMove={(e) => { if (drawingRef.current) { e.preventDefault(); drawSignaturePoint(e); } }}
                  onPointerUp={() => { drawingRef.current = false; }}
                  onPointerCancel={() => { drawingRef.current = false; }}
                  onPointerLeave={() => { drawingRef.current = false; }}
                  className="h-24 w-full cursor-crosshair rounded-lg border border-slate-200 bg-white"
                  style={{ touchAction: 'none' }}
                />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={saveDrawnSignature} className="rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">Use Drawn Signature</button>
                  <button type="button" onClick={clearSignatureCanvas} className="rounded-lg border border-slate-300 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700">Clear</button>
                </div>
              </div>
            </div>
          </div>

          {identityMsg.text ? (
            <p className={`mt-4 rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] ${identityMsg.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {identityMsg.text}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button type="button" disabled={identityLoading} onClick={saveIdentity} className="rounded-xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {identityLoading ? 'Saving...' : 'Save Digital Identity'}
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
