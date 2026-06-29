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
import { GalleryHeader } from "@/components/gallery-header";

export const dynamic = "force-dynamic";

const GALLERY_BUCKET = "gallery";
const COVER_SIZE = 112;

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

const REASON_MAX_LENGTH = 120;

type Props = {
  searchParams: Promise<{ error?: string; max?: string; reason?: string }>;
};

export default async function AlbumsPage({ searchParams }: Props) {
  const userId = await getGallerySession();

  if (!userId) {
    const viziBase = getViziBaseUrl();
    redirect(`${viziBase}/app`);
  }

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = profile?.username?.trim() ?? null;

  const { data: albums, error: fetchError } = await admin
    .from("gallery_albums")
    .select("id, name, description, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  // Auto-create default album for first-time owners. Redirect immediately—never render empty state.
  // If create fails, redirect with reason so UI can show the real error.
  if (!fetchError && albums && albums.length === 0) {
    const createResult = await createAlbum(userId, "Galerija", "");
    if (createResult.ok) {
      const { data: albumsAfter } = await admin
        .from("gallery_albums")
        .select("id, name, description, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (albumsAfter && albumsAfter.length > 0) {
        redirect(`/albums/${albumsAfter[0].id}`);
      }
    }
    const shortError = createResult.ok
      ? ""
      : createResult.error.slice(0, REASON_MAX_LENGTH).trim();
    redirect(
      `/albums?error=auto_create_failed${shortError ? `&reason=${encodeURIComponent(shortError)}` : ""}`
    );
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
  const reasonParam = params.reason?.trim();
  const isAutoCreateFailed = errorCode === "auto_create_failed";
  const isCreateFailed = errorCode === "create_failed";
  const autoCreateMessage = reasonParam
    ? `Kreiranje defaultnog albuma nije uspjelo: ${reasonParam}. Kreiraj album ručno ispod.`
    : ERROR_MESSAGES.auto_create_failed;
  const createFailedMessage =
    reasonParam && isCreateFailed
      ? `${ERROR_MESSAGES.create_failed} (${reasonParam})`
      : ERROR_MESSAGES.create_failed;
  const errorMessage =
    isAutoCreateFailed
      ? autoCreateMessage
      : isCreateFailed
        ? createFailedMessage
        : errorCode && ERROR_MESSAGES[errorCode]
          ? ERROR_MESSAGES[errorCode]
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
    <Card className="border-border bg-card shadow-sm">
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
    <>
      <GalleryHeader />
    <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6">
      <div className="w-full max-w-3xl space-y-6">
        {username && (
          <Button asChild variant="outline" size="default" className="h-8 text-muted-foreground">
            <Link href={`${getViziBaseUrl()}/${username}`}>
              ← Natrag na profil
            </Link>
          </Button>
        )}

        <section className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Moji albumi
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground">
                Uredite albume i slike koje se prikazuju na vašem Vizi profilu.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {addSlikeAlbum && (
                <a
                  href={`/albums/${addSlikeAlbum.id}`}
                  className={buttonVariants()}
                >
                  Dodaj slike
                </a>
              )}
              {hasAlbums && <NewAlbumDialog />}
            </div>
          </div>
        </section>

        {errorMessage && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        {!hasAlbums && newAlbumForm}

        {fetchError ? (
          <p className="text-muted-foreground text-sm">
            Učitavanje albuma nije uspjelo. Pokušaj ponovno kasnije.
          </p>
        ) : albums && albums.length > 0 ? (
          <ul className="space-y-3">
            {albums.map((album) => {
              const coverUrl = coverByAlbumId.get(album.id) ?? null;
              const imageCount =
                imageCountByAlbumId.get(album.id) ?? 0;
              const isDefaultAlbum = album.name === "Galerija";
              return (
                <li key={album.id}>
                  <Card className="overflow-hidden border-border bg-card shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-stretch">
                      <a
                        href={`/albums/${album.id}`}
                        className="group flex min-w-0 flex-1 gap-4 p-4 sm:p-5"
                      >
                        <div className="relative size-[112px] shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt=""
                              width={COVER_SIZE}
                              height={COVER_SIZE}
                              className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                              <ImageIcon className="size-10" aria-hidden />
                            </div>
                          )}
                          <div
                            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-scrim text-xs font-medium uppercase tracking-wide text-scrim-foreground transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                            aria-hidden
                          >
                            Otvori album
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-foreground">
                              {album.name}
                            </span>
                            <span
                              className="shrink-0 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                              aria-label={`${imageCount} slika`}
                            >
                              {imageCountLabel(imageCount)}
                            </span>
                          </div>
                          {isDefaultAlbum && (
                            <p className="text-xs text-muted-foreground/60">
                              Zadani album na profilu
                            </p>
                          )}
                          {album.description && (
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {album.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDate(album.created_at)}
                          </p>
                        </div>
                      </a>
                      <div className="flex items-center border-t border-border px-4 py-3 sm:border-t-0 sm:border-l sm:px-4">
                        <AlbumDeleteButton albumId={album.id} />
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : isAutoCreateFailed ? (
          null
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-6 py-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">
              Započni svoju galeriju
            </h2>
            <p className="text-muted-foreground text-sm">
              Još nemaš albuma. Iskoristi obrazac iznad za kreiranje prvog
              albuma, zatim dodaj slike i podijeli galeriju na svom profilu.
            </p>
            <Button asChild variant="outline">
              <Link href={appUrl}>Natrag u Vizi</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
