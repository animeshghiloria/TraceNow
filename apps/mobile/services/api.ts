import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
});

// Attach JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────
export const verifyFirebaseToken = (idToken: string) => {
  // Mock response
  return Promise.resolve({
    accessToken: 'mock-jwt-token',
    user: {
      id: 'mock-user-123',
      phone: '+91 9876543210',
      name: 'Demo User',
      role: 'citizen'
    }
  });
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const getMe = () => {
  // Mock response
  return Promise.resolve({
    id: 'mock-user-123',
    phone: '+91 9876543210',
    name: 'Demo User',
    role: 'citizen'
  });
};

export const getUserStats = () => {
  // Mock response
  return Promise.resolve({
    totalCases: 5,
    activeCases: 2,
    resolvedCases: 3,
    totalSightings: 8
  });
};

export const updateLocation = (lat: number, lng: number) => {
  // Mock response
  return Promise.resolve({ success: true });
};

export const updateFcmToken = (token: string) => {
  // Mock response
  return Promise.resolve({ success: true });
};

export const updateProfile = (name: string) => {
  // Mock response
  return Promise.resolve({
    id: 'mock-user-123',
    phone: '+91 9876543210',
    name: name,
    role: 'citizen'
  });
};

// ─── Cases ───────────────────────────────────────────────────────────────────
export const getCases = (params?: { status?: string; limit?: number; q?: string }) => {
  // Mock response
  const mockCases = [
    {
      id: 'case-1',
      childName: 'Anushka',
      childAge: '5',
      description: 'Missing child reported',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'New Delhi',
      alertRadius: 5,
      status: 'open',
      createdAt: new Date().toISOString(),
      userId: 'mock-user-123'
    },
    {
      id: 'case-2',
      childName: 'Sumit',
      childAge: '4',
      description: 'Lost child alert',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'Rajiv Chowk, Delhi',
      alertRadius: 3,
      status: 'investigating',
      createdAt: new Date().toISOString(),
      userId: 'mock-user-123'
    }
  ];
  return Promise.resolve(mockCases);
};

export const searchCases = (q: string, status?: string) => {
  // Mock response - filter cases based on search query
  const mockCases = [
    {
      id: 'case-1',
      childName: 'Anushka',
      childAge: '5',
      description: 'Missing child reported',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'New Delhi',
      alertRadius: 5,
      status: 'open',
      createdAt: new Date().toISOString(),
      userId: 'mock-user-123'
    },
    {
      id: 'case-2',
      childName: 'Sumit',
      childAge: '4',
      description: 'Lost child alert',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'Rajiv Chowk, Delhi',
      alertRadius: 3,
      status: 'investigating',
      createdAt: new Date().toISOString(),
      userId: 'mock-user-123'
    }
  ];

  let filteredCases = mockCases;

  // Filter by status if provided
  if (status && status !== 'all') {
    filteredCases = filteredCases.filter(c => c.status === status);
  }

  // Filter by search query if provided
  if (q && q.trim()) {
    const searchTerm = q.toLowerCase().trim();
    filteredCases = filteredCases.filter(c =>
      c.childName.toLowerCase().includes(searchTerm) ||
      c.lastSeenAddr.toLowerCase().includes(searchTerm) ||
      c.description.toLowerCase().includes(searchTerm)
    );
  }

  return Promise.resolve(filteredCases);
};

export const getNearbyCases = (lat: number, lng: number, radius = 20) => {
  // Mock response - using Delhi coordinates for consistency
  const mockNearbyCases = [
    {
      id: 'case-1',
      childName: 'Anushka',
      childAge: '5',
      description: 'Missing child reported',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'New Delhi',
      alertRadius: 2,
      status: 'open',
      createdAt: new Date().toISOString(),
      lat: 28.6139 + 0.01, // Near Delhi
      lng: 77.2090 + 0.01,
      userId: 'user-456'
    },
    {
      id: 'case-2',
      childName: 'Sumit',
      childAge: '4',
      description: 'Lost child alert',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'Rajiv Chowk, Delhi',
      alertRadius: 3,
      status: 'investigating',
      createdAt: new Date().toISOString(),
      lat: 28.6139 - 0.005, // Near Rajiv Chowk area
      lng: 77.2090 - 0.005,
      userId: 'user-789'
    }
  ];
  return Promise.resolve(mockNearbyCases);
};

export const getCaseById = (id: string) => {
  // Mock response - return appropriate case based on ID
  const cases = {
    'case-1': {
      id: 'case-1',
      childName: 'Anushka',
      childAge: '5',
      description: 'Missing child reported',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'New Delhi',
      alertRadius: 5,
      status: 'open',
      createdAt: new Date().toISOString(),
      userId: 'mock-user-123',
      sightings: []
    },
    'case-2': {
      id: 'case-2',
      childName: 'Sumit',
      childAge: '4',
      description: 'Lost child alert',
      lastSeenAt: new Date().toISOString(),
      lastSeenAddr: 'Rajiv Chowk, Delhi',
      alertRadius: 3,
      status: 'investigating',
      createdAt: new Date().toISOString(),
      userId: 'mock-user-123',
      sightings: []
    }
  };
  return Promise.resolve(cases[id as keyof typeof cases] || cases['case-1']);
};

export const createCase = (formData: FormData) => {
  // Mock response
  return Promise.resolve({
    id: 'new-case-' + Date.now(),
    childName: 'New Case',
    childAge: '5',
    description: 'New missing child case',
    lastSeenAt: new Date().toISOString(),
    lastSeenAddr: 'Unknown location',
    alertRadius: 5,
    status: 'open',
    createdAt: new Date().toISOString(),
    userId: 'mock-user-123'
  });
};

export const updateCaseStatus = (id: string, status: string) => {
  // Mock response
  return Promise.resolve({
    id,
    status,
    updatedAt: new Date().toISOString()
  });
};

// ─── Sightings ───────────────────────────────────────────────────────────────
export const getSightings = (caseId: string) => {
  // Mock response
  return Promise.resolve([
    {
      id: 'sighting-1',
      caseId,
      description: 'Seen near the park entrance',
      location: 'Park Entrance',
      lat: 40.7829,
      lng: -73.9654,
      createdAt: new Date().toISOString(),
      userId: 'user-456'
    }
  ]);
};

export const createSighting = (formData: FormData) => {
  // Mock response
  return Promise.resolve({
    id: 'new-sighting-' + Date.now(),
    caseId: 'case-1',
    description: 'New sighting reported',
    location: 'Unknown location',
    lat: 0,
    lng: 0,
    createdAt: new Date().toISOString(),
    userId: 'mock-user-123'
  });
};
