import { useEffect, useState } from 'react';
import { User } from 'lucia';

// Define the session state type
interface SessionState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Custom hook for authentication session
export const useAuthSession = (): SessionState => {
  const [state, setState] = useState<SessionState>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }
        const data = await response.json();
        setState({
          user: data.user || null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setState({
          user: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    fetchSession();
  }, []);

  return state;
};

// Custom hook for user information (replaces useUser from Clerk)
export const useUser = () => {
  const { user, isLoading, error } = useAuthSession();
  
  return {
    isLoaded: !isLoading,
    isSignedIn: !!user,
    user: user,
    error,
  };
};

// Custom hook for authentication (replaces useAuth from Clerk)
export const useAuth = () => {
  const { user, isLoading } = useAuthSession();
  
  return {
    isLoaded: !isLoading,
    userId: user?.id || null,
    sessionId: null, // We don't directly expose session ID for security
    orgId: user?.organizationId || null,
    orgRole: null,
    orgSlug: null,
    actor: null,
    signOut: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (response.ok) {
        window.location.href = '/sign-in';
      }
    },
    getToken: async () => {
      // In a real implementation, you might return an access token
      return null;
    },
  };
};
