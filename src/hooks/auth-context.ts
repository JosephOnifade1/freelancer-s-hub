import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

// Extend User to expose `uid` as an alias for `id`, and add Firebase-compatible fields,
// so existing code that references user.uid, user.displayName, user.photoURL, and user.email
// continues to work without modification.
export type AppUser = User & {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = (): AuthContextType => useContext(AuthContext);
