import React, { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('FRG Enterprise');

  useEffect(() => {
    const initAuth = async () => {
      try {
        const settingsRes = await api.get('/core/settings/');
        if (settingsRes.data?.company_name) {
          setCompanyName(settingsRes.data.company_name);
        }
      } catch (e) {
        console.error("Failed to fetch settings", e);
      }

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
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading, companyName, setCompanyName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
