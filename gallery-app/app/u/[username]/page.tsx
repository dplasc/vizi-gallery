import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

function normalizeUsername(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

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
  params: Promise<{ username: string }>;
};

/**
 * Public user gallery landing. Resolves owner_id from username (profiles table, same DB as Vizi).
 * No auth required.
 */
export default async function PublicUserGalleryPage({ params }: Props) {
  const { username: rawUsername } = await params;
  const username = normalizeUsername(rawUsername);
  if (!username) notFound();

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (profileError || !profile) notFound();
  const ownerId = profile.id;

  const { data: albums, error: albumsError } = await admin
    .from("gallery_albums")
    .select("id, name, description, created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (albumsError) notFound();
  const list = albums ?? [];

  const profileUrl = `https://www.vizi.hr/${username}`;

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
          <Link href={profileUrl} target="_blank" rel="noopener noreferrer">
            ← Natrag na profil
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Galerija — @{username}
        </h1>

        {list.length === 0 ? (
          <p className="text-muted-foreground text-center">Nema albuma.</p>
        ) : (
          <ul className="space-y-4">
            {list.map((album) => (
              <li key={album.id}>
                <Link href={`/u/${encodeURIComponent(rawUsername)}/albums/${album.id}`}>
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
        )}
      </div>
    </main>
  );
}
