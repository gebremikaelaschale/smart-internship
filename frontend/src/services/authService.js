import api from './api';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

const safeParse = (value) => {
  try {
    return JSON.parse(value || 'null');
  } catch {
    return null;
  }
};

export const authService = {
  async login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    this.setSession({ user: data.user, token: data.token });
    return data;
  },

  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    this.setSession({ user: data.user, token: data.token });
    return data;
  },

  async changePassword(payload) {
    const { data } = await api.post('/auth/change-password', payload);
    return data;
  },

  async logout() {
    this.clearSession();
    return true;
  },

  getSession() {
    return {
      token: localStorage.getItem(TOKEN_KEY) || '',
      user: safeParse(localStorage.getItem(USER_KEY))
    };
  },

  setSession({ user, token }) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};
