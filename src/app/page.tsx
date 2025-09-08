"use client";
import {useAuth} from "@/lib/auth-context";

export default function Page() {
  const {user, loading} = useAuth();
  if (loading) return null;
  return <h3>Hola `${user?.email}`</h3>;
}
