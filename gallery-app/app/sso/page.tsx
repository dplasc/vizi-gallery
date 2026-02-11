import Link from "next/link";
import { getViziBaseUrl } from "@/lib/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  searchParams: Promise<{
    token?: string;
    error?: string;
    category?: string;
    from?: string;
    reason?: string;
  }>;
};

export default async function SSOPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim();
  const error = params.error;
  const category = params.category ?? "";
  const from = params.from;
  const reason = params.reason;

  if (error === "invalid" || !token) {
    return (
      <SSOError from={from} category={category} reason={reason} error={error} />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Prijava u galeriju</CardTitle>
            <CardDescription>
              Klikni za dovršetak prijave i preusmjeravanje u galeriju.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              id="sso-form"
              method="POST"
              action="/api/session"
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="token" value={token} />
              <Button type="submit">Nastavi u galeriju</Button>
            </form>
          </CardContent>
          <CardFooter />
        </Card>
      </div>
    </main>
  );
}

function SSOError({
  from: fromParam,
  category = "",
  reason: reasonParam,
  error: errorParam,
}: { from?: string; category?: string; reason?: string; error?: string }) {
  const viziBase = getViziBaseUrl();
  const appUrl = `${viziBase}/app`;
  const categoryLabel = category ? ` (${category})` : "";
  const fromDisplay = fromParam ?? "NONE";
  const categoryDisplay = category || "NONE";
  const reasonDisplay = reasonParam ?? "NONE";
  const errorDisplay = errorParam ?? "NONE";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Neuspjela prijava</CardTitle>
            <CardDescription>
              Token je neispravan ili je istekao{categoryLabel}. Vrati se u Vizi
              i pokušaj ponovno.
            </CardDescription>
            <p className="text-muted-foreground mt-2 text-xs">
              SSO Debug: from={fromDisplay} category={categoryDisplay} reason={reasonDisplay} error={errorDisplay}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              DEPLOY MARKER: 2026-02-11 SSO-DIAG v1
            </p>
          </CardHeader>
          <CardContent />
          <CardFooter>
            <Button asChild>
              <Link href={appUrl}>Natrag u Vizi</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
