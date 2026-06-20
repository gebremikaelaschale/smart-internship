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
    const resolvedToken = nextToken ?? token;
    authService.setSession({ user: nextUser, token: resolvedToken });
    setUser(nextUser || null);
    if (typeof nextToken !== 'undefined') {
      setToken(nextToken || '');
    }
  };

  const updateUser = (patch = {}) => {
    setUser((previousUser) => {
      if (!previousUser) return previousUser;
      const nextUser = { ...previousUser, ...patch };
      authService.setSession({ user: nextUser, token });
      return nextUser;
    });
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
    setSession,
    updateUser
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
