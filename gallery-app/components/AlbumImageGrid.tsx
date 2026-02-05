"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export type AlbumImage = {
  id: string;
  url: string;
  thumbnailUrl?: string;
  key: string;
};

type Props = {
  images: AlbumImage[];
  /** When true, hide delete button and delete dialog (e.g. public gallery view). */
  readOnly?: boolean;
};

export function AlbumImageGrid({ images, readOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const visibleImages = images.filter((img) => !hiddenIds.has(img.id));
  const count = visibleImages.length;
  const current = count > 0 ? visibleImages[index] : null;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? count - 1 : i - 1));
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= count - 1 ? 0 : i + 1));
  }, [count]);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, count - 1)));
    if (count === 0) setOpen(false);
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goPrev, goNext]);

  async function handleConfirmDelete() {
    const id = deleteTargetId;
    if (!id || deleting) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/gallery/images/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: id }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDeleteError(data?.error ?? `Error ${res.status}`);
        setDeleting(false);
        return;
      }

      setDeleteTargetId(null);
      setDeleting(false);
      setHiddenIds((prev) => new Set(prev).add(id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <>
      <p className="text-muted-foreground mb-3 text-center text-sm">
        Kliknite na sliku za pregled.
      </p>

      {!readOnly && deleteError && (
        <div
          className="mb-3 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400"
          role="alert"
        >
          {deleteError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {visibleImages.map((img, i) => (
          <div key={img.id} className="relative aspect-square">
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="h-full w-full overflow-hidden rounded-md border border-border bg-muted text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {(img.thumbnailUrl ?? img.url) ? (
                <img
                  src={img.thumbnailUrl ?? img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-muted-foreground block p-2 text-xs">
                  {img.key}
                </span>
              )}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteError(null);
                  setDeleteTargetId(img.id);
                }}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded bg-black/50 text-white transition-opacity hover:bg-red-600 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Obriši sliku"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
      <Dialog
        open={!!deleteTargetId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetId(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Obriši sliku?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Ova akcija je nepovratna.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteTargetId(null);
                setDeleteError(null);
              }}
              disabled={deleting}
            >
              Odustani
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "Brišem..." : "Obriši"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Slika {count > 0 ? `${index + 1} / ${count}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-[200px] items-center justify-center bg-muted/30 py-4">
            {current?.url ? (
              <img
                src={current.url}
                alt=""
                className="max-h-[70vh] max-w-full object-contain"
              />
            ) : (
              <span className="text-muted-foreground text-sm">
                {current?.key ?? ""}
              </span>
            )}
          </div>
          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={goPrev}
                disabled={count <= 1}
              >
                Prethodna
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={goNext}
                disabled={count <= 1}
              >
                Sljedeća
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Zatvori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
