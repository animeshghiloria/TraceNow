import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

const WS_URL = Constants.expoConfig?.extra?.wsUrl ?? 'http://localhost';

// Mock socket implementation - doesn't actually connect
class MockSocket {
  connected = true;
  id = 'mock-socket-id';

  on(event: string, callback: Function) {
    // Mock - do nothing
    console.log(`[Mock WS] Registered listener for: ${event}`);
  }

  off(event: string) {
    // Mock - do nothing
    console.log(`[Mock WS] Removed listener for: ${event}`);
  }

  emit(event: string, data: any) {
    // Mock - do nothing
    console.log(`[Mock WS] Emitted: ${event}`, data);
  }

  disconnect() {
    this.connected = false;
    console.log('[Mock WS] Disconnected');
  }
}

let socket: MockSocket | null = null;

export const getSocket = (): MockSocket => {
  if (!socket) {
    socket = new MockSocket();
    console.log('[Mock WS] Connected:', socket.id);
  }
  return socket;
};

export const subscribeToCase = (caseId: string) => {
  getSocket().emit('subscribe_case', { caseId });
};

/**
 * Subscribe to area-level case broadcasts.
 * Uses a simple ~5.5 km grid cell prefix (1 decimal place lat/lng)
 * instead of requiring an external geohash library.
 * e.g. lat=28.6 lng=77.2 → geohash "28.6_77.2"
 */
export const subscribeToArea = (lat: number, lng: number) => {
  const geohash = `${lat.toFixed(1)}_${lng.toFixed(1)}`;
  getSocket().emit('subscribe_area', { geohash });
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};
