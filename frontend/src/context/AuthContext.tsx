import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserAccount, UserProfile } from '../types/auth';
import { fetchCurrentUser, logoutUser } from '../api/client';

interface AuthContextType {
  user: UserAccount | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: UserAccount) => void;
  logout: () => Promise<void>;
  updateUserContext: (profile: UserProfile) => void;
}

const AUTH_TOKEN_KEY = 'unpack_auth_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  });
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session if token exists
  const restoreSession = useCallback(async (savedToken: string) => {
    setIsLoading(true);
    try {
      const userData = await fetchCurrentUser(savedToken);
      setUser(userData);
      setToken(savedToken);
    } catch {
      // If token is invalid or server rejected, clear it
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (savedToken) {
      restoreSession(savedToken);
    } else {
      setIsLoading(false);
    }
  }, [restoreSession]);

  const login = (newToken: string, newUser: UserAccount) => {
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    if (token) {
      await logoutUser(token);
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const updateUserContext = (newProfile: UserProfile) => {
    setUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        profile: {
          ...prev.profile,
          ...newProfile,
        },
      };
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        updateUserContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
