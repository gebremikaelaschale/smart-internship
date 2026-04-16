import React, { createContext, useEffect, useMemo, useState } from 'react';
import { authService } from '@/services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = authService.getSession();
    setUser(session.user);
    setToken(session.token);
    setLoading(false);
  }, []);

  const setSession = ({ user: nextUser, token: nextToken }) => {
    authService.setSession({ user: nextUser, token: nextToken });
    setUser(nextUser || null);
    setToken(nextToken || '');
  };

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setSession({ user: data.user, token: data.token });
    return data;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setToken('');
  };

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    login,
    logout,
    setSession
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
