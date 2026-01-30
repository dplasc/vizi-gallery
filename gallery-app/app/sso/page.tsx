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

type Props = {
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function SSOPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim();
  const error = params.error;

  if (error === "invalid" || !token) {
    return <SSOError />;
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

function SSOError() {
  const viziBase = getViziBaseUrl();
  const appUrl = `${viziBase}/app`;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Neuspjela prijava</CardTitle>
            <CardDescription>
              Token je neispravan ili je istekao. Vrati se u Vizi i pokušaj
              ponovno.
            </CardDescription>
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
