import { createContext, useContext } from "react";
import type { ProvisioningState } from "@/lib/provisioning-state";
export interface AppUser { id: string; uid: string; email: string; emailVerified: boolean; displayName: string | null; photoURL: string | null }
export interface AuthContextType {
  authError?: boolean; retrySession?: () => void;
  user: AppUser | null; loading: boolean; signOut: () => Promise<void>;
  provisioning: ProvisioningState; retryProvisioning: () => void; isProvisioned: boolean;
}
export const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: async () => {}, provisioning: { status: "pending", attempts: 0 }, retryProvisioning: () => {}, isProvisioned: false });
export const useAuth = () => useContext(AuthContext);
