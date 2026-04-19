import React, { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 30, retry: 2 },
  },
});

/**
 * Auth redirect guard — placed inside AuthProvider so it can read context.
 * Now automatically redirects to home page since we have mock authentication.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return; // wait for session restore

    const inAuthGroup = segments[0] === '(auth)';

    // Always redirect to home page since we have mock authentication
    if (inAuthGroup) {
      // Use setTimeout to ensure router is ready
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    }
  }, [user, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="case/[id]" />
              <Stack.Screen name="authority" />
            </Stack>
          </AuthGuard>
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
