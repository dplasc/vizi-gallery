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

export type AlbumImage = {
  id: string;
  url: string;
  key: string;
};

type Props = {
  images: AlbumImage[];
};

export function AlbumImageGrid({ images }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const count = images.length;
  const current = count > 0 ? images[index] : null;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? count - 1 : i - 1));
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= count - 1 ? 0 : i + 1));
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

  return (
    <>
      <p className="text-muted-foreground mb-3 text-center text-sm">
        Kliknite na sliku za pregled.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            className="aspect-square overflow-hidden rounded-md border border-border bg-muted text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {img.url ? (
              <img
                src={img.url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-muted-foreground block p-2 text-xs">
                {img.key}
              </span>
            )}
          </button>
        ))}
      </div>

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
