"use client";
import { useAuth } from "@/lib/auth-context";
import LoginView from "@/components/LoginView";
import Money from "@/components/Money";

export default function MoneyPage(){
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Money /> : <LoginView />;
}
