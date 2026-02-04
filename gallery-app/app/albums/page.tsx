import { redirect } from "next/navigation";
import Link from "next/link";
import { getGallerySession } from "@/lib/cookies";
import { getViziBaseUrl } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAlbum } from "@/lib/albums";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageIcon } from "lucide-react";
import { NewAlbumDialog } from "./NewAlbumDialog";
import { AlbumDeleteButton } from "@/components/AlbumDeleteButton";

export const dynamic = "force-dynamic";

const GALLERY_BUCKET = "gallery";
const COVER_SIZE = 96;

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Neispravan zahtjev.",
  name_required: "Naziv albuma je obavezan.",
  name_too_long: "Naziv je predugačak.",
  description_too_long: "Opis je predugačak.",
  create_failed: "Kreiranje albuma nije uspjelo. Pokušaj ponovno.",
  auto_create_failed: "Kreiranje defaultnog albuma nije uspjelo. Kreiraj album ručno ispod.",
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

function imageCountLabel(count: number): string {
  return count === 1 ? "1 slika" : `${count} slika`;
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

  // Auto-create default album for first-time owners. Redirect immediately—never render empty state.
  // If create fails, render create form + error (fallback).
  let attemptedAutoCreateAndFailed = false;
  if (!fetchError && albums && albums.length === 0) {
    await createAlbum(userId, "Galerija", "");
    const { data: albumsAfter } = await admin
      .from("gallery_albums")
      .select("id, name, description, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (albumsAfter && albumsAfter.length > 0) {
      redirect(`/albums/${albumsAfter[0].id}`);
    }
    attemptedAutoCreateAndFailed = true;
  }

  const albumIds = (albums ?? []).map((a) => a.id);
  const coverByAlbumId = new Map<string, string>();
  const imageCountByAlbumId = new Map<string, number>();
  for (const id of albumIds) imageCountByAlbumId.set(id, 0);

  if (albumIds.length > 0) {
    const { data: coverRows } = await admin
      .from("gallery_images")
      .select("album_id, storage_key_original, storage_key_optimized")
      .in("album_id", albumIds)
      .eq("owner_id", userId)
      .order("id", { ascending: false });

    for (const row of coverRows ?? []) {
      if (row.album_id)
        imageCountByAlbumId.set(
          row.album_id,
          (imageCountByAlbumId.get(row.album_id) ?? 0) + 1
        );
    }

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

  const params = await searchParams;
  const errorCode = params.error?.trim();
  const errorMessage =
    errorCode && ERROR_MESSAGES[errorCode]
      ? ERROR_MESSAGES[errorCode]
      : attemptedAutoCreateAndFailed
        ? ERROR_MESSAGES.auto_create_failed
        : errorCode
          ? "Došlo je do greške."
          : null;

  const viziBase = getViziBaseUrl();
  const appUrl = `${viziBase}/app`;

  const hasAlbums = albums && albums.length > 0;
  const addSlikeAlbum = hasAlbums
    ? albums!.find((a) => a.name === "Galerija") ?? albums![0]
    : null;

  const newAlbumForm = (
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
  );

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Moji albumi</h1>
          {addSlikeAlbum && (
            <a
              href={`/albums/${addSlikeAlbum.id}`}
              className={buttonVariants()}
            >
              Dodaj slike
            </a>
          )}
        </div>

        {errorMessage && (
          <div
            className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {hasAlbums ? (
          <NewAlbumDialog />
        ) : (
          newAlbumForm
        )}

        {fetchError ? (
          <p className="text-muted-foreground text-sm">
            Učitavanje albuma nije uspjelo. Pokušaj ponovno kasnije.
          </p>
        ) : albums && albums.length > 0 ? (
          <ul className="space-y-4">
            {albums.map((album) => {
              const coverUrl = coverByAlbumId.get(album.id) ?? null;
              const imageCount =
                imageCountByAlbumId.get(album.id) ?? 0;
              return (
                <li key={album.id}>
                  <Card className="transition-colors hover:border-primary/50">
                    <CardHeader className="flex flex-row items-start gap-4 pb-2">
                      <a
                        href={`/albums/${album.id}`}
                        className="group flex min-w-0 flex-1"
                      >
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
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-lg">
                              {album.name}
                            </CardTitle>
                            <span
                              className="shrink-0 rounded-full border border-border/80 bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground"
                              aria-label={`${imageCount} slika`}
                            >
                              {imageCountLabel(imageCount)}
                            </span>
                          </div>
                          {album.description && (
                            <CardDescription>
                              {album.description}
                            </CardDescription>
                          )}
                          <p className="text-muted-foreground text-xs">
                            {formatDate(album.created_at)}
                          </p>
                        </div>
                      </a>
                      <div className="shrink-0">
                        <AlbumDeleteButton albumId={album.id} />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0" />
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : attemptedAutoCreateAndFailed ? (
          null
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
