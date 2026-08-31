import React, { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import api, { API_BASE_URL } from '../services/api';

const AuthContext = createContext();

export const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('FRG Enterprise');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyTagline, setCompanyTagline] = useState('Secure Enterprise Workspace Portal');

  const refreshCompanySettings = async () => {
    try {
      const settingsRes = await api.get('/core/settings/');
      if (settingsRes.data) {
        if (settingsRes.data.company_name) setCompanyName(settingsRes.data.company_name);
        if (settingsRes.data.company_logo !== undefined) setCompanyLogo(settingsRes.data.company_logo);
        if (settingsRes.data.company_tagline) setCompanyTagline(settingsRes.data.company_tagline);
      }
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      await refreshCompanySettings();

      const token = localStorage.getItem('access_token');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        try {
          const decoded = jwtDecode(token);
          if (decoded.exp * 1000 < Date.now()) {
            logout();
          } else {
            const parsed = JSON.parse(savedUser);
            setUser(parsed);
            // Re-validate and refresh user profile data in the background
            api.get('/auth/me/').then(meRes => {
              if (meRes.data) {
                const refreshedUser = { ...parsed, ...meRes.data };
                localStorage.setItem('user', JSON.stringify(refreshedUser));
                setUser(refreshedUser);
              }
            }).catch(() => {});
          }
        } catch (e) {
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login/', { email, password });
    const { access, refresh, user: userData } = res.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(userData));

    setUser(userData);
    await refreshCompanySettings();
    return userData;
  };

  const logout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        await api.post('/auth/logout/', { refresh });
      }
    } catch (e) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const updateUser = (newUserData) => {
    const updatedUser = { ...user, ...newUserData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, updateUser, loading,
      companyName, setCompanyName,
      companyLogo, setCompanyLogo,
      companyTagline, setCompanyTagline,
      refreshCompanySettings,
      getMediaUrl
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      loading: false,
      companyName: 'FRG Enterprise',
      companyLogo: null,
      companyTagline: 'Secure Enterprise Workspace Portal',
      getMediaUrl: (url) => getMediaUrl(url),
      login: async () => {},
      logout: async () => {},
      updateUser: () => {},
      refreshCompanySettings: async () => {},
      setCompanyName: () => {},
      setCompanyLogo: () => {},
      setCompanyTagline: () => {}
    };
  }
  return context;
};
