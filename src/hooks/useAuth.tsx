import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { User } from "@supabase/supabase-js";

// Extend User to expose `uid` as an alias for `id`, and add Firebase-compatible fields,
// so all existing code that references user.uid, user.displayName, user.photoURL, and user.email
// continues to work without modification.
export type AppUser = User & {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

function toAppUser(user: User | null): AppUser | null {
  if (!user) return null;
  return Object.assign(user, {
    uid: user.id,
    displayName: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? null,
    photoURL: user.user_metadata?.avatar_url ?? null,
  }) as AppUser;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(toAppUser(session?.user ?? null));
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAppUser(session?.user ?? null));
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
