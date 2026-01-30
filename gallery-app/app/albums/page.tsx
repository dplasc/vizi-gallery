import { redirect } from "next/navigation";
import Link from "next/link";
import { getGallerySession } from "@/lib/cookies";
import { getViziBaseUrl } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Neispravan zahtjev.",
  name_required: "Naziv albuma je obavezan.",
  name_too_long: "Naziv je predugačak.",
  description_too_long: "Opis je predugačak.",
  create_failed: "Kreiranje albuma nije uspjelo. Pokušaj ponovno.",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("hr-HR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type Props = {
  searchParams: Promise<{ error?: string; max?: string }>;
};

export default async function AlbumsPage({ searchParams }: Props) {
  const userId = await getGallerySession();

  if (!userId) {
    const viziBase = getViziBaseUrl();
    redirect(`${viziBase}/app`);
  }

  const admin = createSupabaseAdminClient();
  const { data: albums, error: fetchError } = await admin
    .from("gallery_albums")
    .select("id, name, description, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  const params = await searchParams;
  const errorCode = params.error?.trim();
  const errorMessage =
    errorCode && ERROR_MESSAGES[errorCode]
      ? ERROR_MESSAGES[errorCode]
      : errorCode
        ? "Došlo je do greške."
        : null;

  const viziBase = getViziBaseUrl();
  const appUrl = `${viziBase}/app`;

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">Moji albumi</h1>

        {errorMessage && (
          <div
            className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Novi album</CardTitle>
            <CardDescription>Unesi naziv i opcionalno opis.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action="/api/albums"
              method="POST"
              className="flex flex-col gap-4"
            >
              <div className="space-y-2">
                <label htmlFor="album-name" className="text-sm font-medium">
                  Naziv (obavezno)
                </label>
                <Input
                  id="album-name"
                  name="name"
                  type="text"
                  placeholder="npr. Ljeto 2025"
                  required
                  maxLength={200}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="album-description" className="text-sm font-medium">
                  Opis (opcionalno)
                </label>
                <Textarea
                  id="album-description"
                  name="description"
                  placeholder="Kratki opis albuma"
                  rows={2}
                  maxLength={2000}
                  className="resize-none"
                />
              </div>
              <Button type="submit">Kreiraj album</Button>
            </form>
          </CardContent>
        </Card>

        {fetchError ? (
          <p className="text-muted-foreground text-sm">
            Učitavanje albuma nije uspjelo. Pokušaj ponovno kasnije.
          </p>
        ) : albums && albums.length > 0 ? (
          <ul className="space-y-4">
            {albums.map((album) => (
              <li key={album.id}>
                <Link href={`/albums/${album.id}`}>
                  <Card className="transition-colors hover:border-primary/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{album.name}</CardTitle>
                      {album.description && (
                        <CardDescription>{album.description}</CardDescription>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {formatDate(album.created_at)}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">Još nemaš albuma.</p>
            <Button asChild variant="outline">
              <Link href={appUrl}>Natrag u Vizi</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
