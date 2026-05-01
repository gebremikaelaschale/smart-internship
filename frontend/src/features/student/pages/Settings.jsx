import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { studentAPI } from '../studentAPI';

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
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default function Settings() {
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [notifications, setNotifications] = useState({ emailAlerts: true, statusUpdates: true });
  const [loading, setLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [notifMsg, setNotifMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const response = await studentAPI.getPreferences();
        const prefs = response.data.notifications;
        setNotifications({
          emailAlerts: prefs.emailAlerts ?? true,
          statusUpdates: prefs.statusUpdates ?? true
        });
      } catch (err) {
        console.error("Failed to load preferences", err);
      }
    };
    fetchPrefs();
  }, []);

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    if (message.text) setMessage({ type: '', text: '' });
  };

  const handleNotifToggle = async (key, val) => {
    const newNotifs = { ...notifications, [key]: val };
    setNotifications(newNotifs);
    setNotifLoading(true);
    try {
      await studentAPI.updateNotifications({ [key]: val });
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
      const response = await studentAPI.sendTestEmail();
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
      const response = await studentAPI.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      setMessage({ type: 'success', text: response.data.message || 'Password updated successfully!' });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-10 pb-20 px-6 lg:px-10">
      {/* 💎 Cyan Hero Section */}
      <div className="mb-8">
        <div className="bg-gradient-to-br from-cyan-50/50 to-sky-50/50 rounded-[40px] p-10 relative overflow-hidden border border-cyan-100/50">
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 mb-2">SYSTEM PREFERENCES</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Account Settings</h2>
            <p className="text-slate-500 mt-2 font-medium max-w-lg">Manage your security and notification settings. Test your email connection to ensure you receive updates.</p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* 🔒 Account Security Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-900">Account Security</h3>
            </div>

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

              <button type="submit" disabled={loading} className="group relative w-full overflow-hidden rounded-2xl bg-slate-900 py-4.5 text-[11px] font-black uppercase tracking-[0.25em] text-white shadow-xl hover:bg-cyan-700 transition-all active:scale-[0.98] disabled:opacity-70">
                <div className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                  <span>{loading ? 'Synchronizing...' : 'Update Password'}</span>
                </div>
              </button>
            </form>
          </Card>
        </motion.div>

        {/* 🔔 Notification Preferences Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-900">Notifications</h3>
            </div>

            <div className="space-y-2 divide-y divide-slate-50">
              <Toggle label="Email Alerts for New Internship Matches" enabled={notifications.emailAlerts} loading={notifLoading} onChange={(val) => handleNotifToggle('emailAlerts', val)} />
              <Toggle label="Application Status Updates" enabled={notifications.statusUpdates} loading={notifLoading} onChange={(val) => handleNotifToggle('statusUpdates', val)} />
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50">
              <button 
                onClick={sendTestEmail}
                disabled={testLoading}
                className="w-full bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-2xl py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
              >
                {testLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
                ) : '📧 Send Test Email'}
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

            <div className="mt-10 p-5 bg-sky-50 rounded-[24px] border border-sky-100 flex gap-4">
              <div className="text-xl">💡</div>
              <p className="text-xs font-bold text-sky-700 leading-relaxed">Use the test button to confirm your email is receiving system updates correctly.</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
