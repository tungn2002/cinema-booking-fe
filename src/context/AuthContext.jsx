import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { getUserInfoFromToken, isTokenExpired } from '../utils/jwt';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        // Check if token is expired
        if (isTokenExpired(storedToken)) {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        } else {
          // Decode user info from JWT token
          const userInfo = getUserInfoFromToken(storedToken);
          if (userInfo) {
            setUser(userInfo);
            setToken(storedToken);
          } else {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
          }
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await authAPI.login({ username, password });
      const { data } = response.data;

      return loginWithToken(data.token);
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const loginWithToken = (tokenValue) => {
    try {
      localStorage.setItem('token', tokenValue);

      // Decode user info from JWT token (no need to call API)
      const userInfo = getUserInfoFromToken(tokenValue);

      if (!userInfo) {
        throw new Error('Invalid token received');
      }

      localStorage.setItem('user', JSON.stringify(userInfo));

      setToken(tokenValue);
      setUser(userInfo);

      return { success: true, user: userInfo, isAdmin: userInfo.isAdmin };
    } catch (error) {
      console.error('Login with token error:', error);
      return { success: false, message: 'Invalid token' };
    }
  };

  const register = async (username, email, password) => {
    try {
      await authAPI.register({ username, email, password });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const checkAdmin = () => {
    // Check from current token directly
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return false;
    
    const userInfo = getUserInfoFromToken(currentToken);
    const isAdmin = userInfo?.isAdmin || false;
    
    // Update user state if needed
    if (user && user.isAdmin !== isAdmin) {
      const updatedUser = { ...user, isAdmin };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
    
    return isAdmin;
  };

  const value = {
    user,
    token,
    loading,
    login,
    loginWithToken,
    register,
    logout,
    checkAdmin,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
