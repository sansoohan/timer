// contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '~/constants/firebase';

type AuthContextValue = {
  user: User | null;
  currentUserUid:  string | null;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const currentUserUid = user?.uid ?? null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      setUser(fbUser);
      setInitializing(false);
    });

    return unsub;
  }, []);

  const value: AuthContextValue = {
    user,
    currentUserUid,
    initializing,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
