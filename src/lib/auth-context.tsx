"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, User } from "firebase/auth";
import { auth } from "./firebase";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Ctx = {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  reset(email: string): Promise<void>;
  logout(): Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u ?? null);
      setLoading(false);
    });
  }, []);

  return (
    <AuthCtx.Provider value={{
      user, loading,
      async login(email, password){ await signInWithEmailAndPassword(auth, email, password); },
      async register(email, password){ await createUserWithEmailAndPassword(auth, email, password); },
      async reset(email){ await sendPasswordResetEmail(auth, email); },
      async logout(){ await signOut(auth); },
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
