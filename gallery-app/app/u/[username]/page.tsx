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
import { ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const GALLERY_BUCKET = "gallery";
const COVER_SIZE = 96;

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
  const albumIds = list.map((a) => a.id);
  const coverByAlbumId = new Map<string, string>();

  if (albumIds.length > 0) {
    const { data: coverRows } = await admin
      .from("gallery_images")
      .select("album_id, storage_key_original, storage_key_optimized")
      .in("album_id", albumIds)
      .eq("owner_id", ownerId)
      .order("id", { ascending: false });

    const albumToKey = new Map<string, string>();
    for (const row of coverRows ?? []) {
      if (row.album_id && !albumToKey.has(row.album_id)) {
        const key =
          row.storage_key_optimized?.trim() ||
          row.storage_key_original?.trim() ||
          "";
        if (key) albumToKey.set(row.album_id, key);
      }
    }

    const coverKeys = [...new Set(albumToKey.values())];
    if (coverKeys.length > 0) {
      const { data: signedData } = await admin.storage
        .from(GALLERY_BUCKET)
        .createSignedUrls(coverKeys, 60 * 10);
      if (signedData) {
        const keyToUrl = new Map<string, string>();
        for (const item of signedData) {
          if (item.path && item.signedUrl)
            keyToUrl.set(item.path, item.signedUrl);
        }
        for (const [aid, key] of albumToKey) {
          const url = keyToUrl.get(key);
          if (url) coverByAlbumId.set(aid, url);
        }
      }
    }
  }

  const profileUrl = `https://www.vizi.hr/${username}`;

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        <Button asChild variant="outline" className="text-muted-foreground -ml-2">
          <Link href={profileUrl} target="_blank" rel="noopener noreferrer">
            ← Natrag na profil
          </Link>
        </Button>
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Galerija</h1>
          <p className="text-muted-foreground text-sm">@{username}</p>
          <p className="text-muted-foreground text-sm">Fotografije i albumi</p>
        </header>

        {list.length === 0 ? (
          <p className="text-muted-foreground text-center">Nema albuma.</p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">Odaberi album</p>
            <ul className="space-y-4">
              {list.map((album) => {
                const coverUrl = coverByAlbumId.get(album.id) ?? null;
                return (
                  <li key={album.id}>
                    <Link
                      href={`/u/${encodeURIComponent(rawUsername)}/albums/${album.id}`}
                      className="group block"
                    >
                      <Card className="transition-colors hover:border-primary/50">
                        <CardHeader className="flex flex-row items-start gap-4 pb-2">
                          <div className="relative size-[96px] shrink-0 overflow-hidden rounded-lg bg-muted">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt=""
                                width={COVER_SIZE}
                                height={COVER_SIZE}
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                                <ImageIcon className="size-10" aria-hidden />
                              </div>
                            )}
                            <div
                              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-xs font-medium uppercase tracking-wide text-white/95 transition-opacity duration-200 opacity-60 group-hover:opacity-100"
                              aria-hidden
                            >
                              Otvori album
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <CardTitle className="text-lg">{album.name}</CardTitle>
                            {album.description && (
                              <CardDescription>{album.description}</CardDescription>
                            )}
                            <p className="text-muted-foreground text-xs">
                              {formatDate(album.created_at)}
                            </p>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0" />
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
