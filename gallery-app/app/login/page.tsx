"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("error");
    setUrlError(q === "missing_code" || q === "exchange_failed");
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setStatus("error");
      setMessage("Unesite email.");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      setStatus("sent");
      setMessage("Provjerite email — poslali smo vam link za prijavu.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Greška pri slanju.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Prijava</CardTitle>
            <CardDescription>
              Za lokalnu prijavu unesite email. Poslat ćemo vam link za prijavu
              (magic link).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {urlError && (
              <p className="text-sm text-amber-500">
                Link je istekao ili neispravan. Zatražite novi kod ispod.
              </p>
            )}
            {status === "sent" ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : (
              <form onSubmit={handleSendCode} className="space-y-4">
                <Input
                  type="email"
                  placeholder="email@primjer.hr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "sending"}
                  autoComplete="email"
                  className="bg-background"
                />
                {status === "error" && message && (
                  <p className="text-sm text-amber-500">{message}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={status === "sending"}
                >
                  {status === "sending" ? "Šaljem…" : "Pošalji kod"}
                </Button>
              </form>
            )}
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/" className="underline hover:text-foreground">
                ← Natrag
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
