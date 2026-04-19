import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  phone: string;
  name: string | null;
  role: 'citizen' | 'authority' | 'admin';
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (firebaseIdToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Automatically log in with a mock user
    (async () => {
      const mockUser: User = {
        id: 'mock-user-123',
        phone: '+91 9876543210',
        name: 'Demo User',
        role: 'citizen'
      };
      const mockToken = 'mock-jwt-token';
      
      await SecureStore.setItemAsync('access_token', mockToken);
      setAccessToken(mockToken);
      setUser(mockUser);
      setIsLoading(false);
    })();
  }, []);

  const login = async (firebaseIdToken: string) => {
    // Mock login - just set the user
    const mockUser: User = {
      id: 'mock-user-123',
      phone: '+91 9876543210',
      name: 'Demo User',
      role: 'citizen'
    };
    const mockToken = 'mock-jwt-token';
    
    await SecureStore.setItemAsync('access_token', mockToken);
    setAccessToken(mockToken);
    setUser(mockUser);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('access_token');
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
