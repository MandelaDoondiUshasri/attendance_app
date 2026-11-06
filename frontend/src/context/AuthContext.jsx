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

export const hasProfilePhoto = (user) => {
  if (!user) return false;
  if (user.has_profile_photo === true) return true;
  if (user.avatar && typeof user.avatar === 'string' && user.avatar.trim() !== '') return true;
  if (user.profile_photo && typeof user.profile_photo === 'string' && user.profile_photo.trim() !== '') return true;
  return false;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('ATTENDX');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [companyTagline, setCompanyTagline] = useState('Enterprise Attendance & Workforce Suite');
  const [companyAddress, setCompanyAddress] = useState('Plot No. 42, Hitech City, Hyderabad, Telangana - 500081');
  const [contactEmail, setContactEmail] = useState('support@attendx.com');
  const [contactPhone, setContactPhone] = useState('+91 40 1234 5678');

  const refreshCompanySettings = async (currentUser = null) => {
    try {
      const settingsRes = await api.get('/core/settings/');
      if (settingsRes.data) {
        const activeUser = currentUser || user;
        // User's assigned company is ALWAYS authoritative over global server settings
        if (activeUser?.company_name) {
          setCompanyName(activeUser.company_name);
        } else if (settingsRes.data.company_name) {
          setCompanyName(settingsRes.data.company_name);
        }

        // Only use company logo if user is not a separate tenant or if logo belongs to tenant
        const isMaster = activeUser?.is_master_tenant === true || activeUser?.company_slug === 'frg';
        if (!activeUser || isMaster) {
          setCompanyLogo(settingsRes.data.company_logo || null);
        } else {
          // Tenant company: only use logo if tenant explicitly configured one
          setCompanyLogo(settingsRes.data.company_logo || null);
        }

        if (settingsRes.data.company_tagline) setCompanyTagline(settingsRes.data.company_tagline);
        if (settingsRes.data.company_address) setCompanyAddress(settingsRes.data.company_address);
        if (settingsRes.data.contact_email) setContactEmail(settingsRes.data.contact_email);
        if (settingsRes.data.contact_phone) setContactPhone(settingsRes.data.contact_phone);
      }
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
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
            if (parsed.company_name) {
              setCompanyName(parsed.company_name);
            }
            // Re-validate and refresh user profile data in the background
            api.get('/auth/me/').then(meRes => {
              if (meRes.data) {
                const refreshedUser = { ...parsed, ...meRes.data };
                localStorage.setItem('user', JSON.stringify(refreshedUser));
                setUser(refreshedUser);
                if (refreshedUser.company_name) {
                  setCompanyName(refreshedUser.company_name);
                }
              }
            }).catch(() => {});
          }
        } catch (e) {
          logout();
        }
      }

      await refreshCompanySettings(parsed);
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
    if (userData?.company_name) {
      setCompanyName(userData.company_name);
    }
    await refreshCompanySettings(userData);
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
      setCompanyName('ATTENDX');
      setCompanyLogo(null);
      setCompanyTagline('Enterprise Attendance & Workforce Suite');
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
      companyAddress, setCompanyAddress,
      contactEmail, setContactEmail,
      contactPhone, setContactPhone,
      refreshCompanySettings,
      getMediaUrl,
      hasProfilePhoto: (u = user) => hasProfilePhoto(u)
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
      companyName: 'ATTENDX',
      companyLogo: null,
      companyTagline: 'Enterprise Attendance & Workforce Suite',
      companyAddress: 'Plot No. 42, Hitech City, Hyderabad, Telangana - 500081',
      contactEmail: 'support@attendx.com',
      contactPhone: '+91 40 1234 5678',
      getMediaUrl: (url) => getMediaUrl(url),
      hasProfilePhoto: () => false,
      login: async () => {},
      logout: async () => {},
      updateUser: () => {},
      refreshCompanySettings: async () => {},
      setCompanyName: () => {},
      setCompanyLogo: () => {},
      setCompanyTagline: () => {},
      setCompanyAddress: () => {},
      setContactEmail: () => {},
      setContactPhone: () => {}
    };
  }
  return context;
};
