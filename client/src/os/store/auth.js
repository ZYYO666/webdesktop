import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createApi } from '../api/index';

export const useAuthStore = defineStore('auth', () => {
  const api = createApi();

  const parseUser = () => {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // State
  const token = ref(localStorage.getItem('auth_token') || null);
  const user = ref(parseUser());

  // Actions
  const setAuth = (newToken, newUser) => {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
  };

  const clearAuth = () => {
    token.value = null;
    user.value = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setAuth(data.token, data.user);
    return true;
  };

  const register = async (username, password) => {
    await api.register(username, password);
    return true;
  };

  const logout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  const hasRole = (minRole) => {
    if (!user.value) return minRole === 'guest';
    const roles = ['guest', 'user', 'admin'];
    const userRoleIndex = roles.indexOf(user.value.role);
    const minRoleIndex = roles.indexOf(minRole);
    return userRoleIndex >= minRoleIndex;
  };

  // Computed
  const isLoggedIn = computed(() => !!token.value);

  return {
    token,
    user,
    isLoggedIn,
    login,
    register,
    logout,
    hasRole
  };
});
