"use client";

/*
 * Flow: optimize (client) -> upload-url (temp path) -> PUT to signed URL -> promote (copy temp to album + insert gallery_images) -> [upload thumb, update storage_key_thumb] -> router.refresh().
 * - upload-url called without albumId so path is ownerId/temp/... (promote requires tempPath).
 * - Thumb: after promote, upload to ownerId/albumId/<imageId>_thumb.jpg via customPath; then update row storage_key_thumb (client Supabase, RLS).
 * - Promote requires gallery_session (cookies sent by same-origin fetch).
 * - 403 quota_exceeded -> "Quota exceeded"; promote failure -> show response error.
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { prepareUploadImages } from "@/lib/images/prepareUploadImage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UploadUrlApiResponse = {
  signedUrl: string;
  path: string;
  bucket: string;
};

type Props = {
  ownerId: string;
  albumId: string;
};

const UPLOAD_OPTIMIZE_MAX_SIDE = 2000;
const UPLOAD_OPTIMIZE_MAX_BYTES = 5 * 1024 * 1024;
const THUMB_MAX_SIDE = 400;
const THUMB_MAX_BYTES = 250 * 1024;

function uploadErrorMessage(status: number, error?: unknown): string {
  const code = typeof error === "string" ? error.trim() : "";
  if (code === "quota_exceeded") {
    return "Premašili ste dopušteni prostor za slike.";
  }
  if (status === 403) {
    return "Nemate dopuštenje za učitavanje.";
  }
  if (status >= 500) {
    return "Poslužitelj trenutno nije dostupan. Pokušajte ponovno kasnije.";
  }
  return `Učitavanje nije uspjelo. Pokušajte ponovno. (greška ${status})`;
}

export function UploadToAlbumCard({ ownerId, albumId }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationSkippedToast, setOptimizationSkippedToast] = useState<string | null>(null);
  const [thumbFailedToast, setThumbFailedToast] = useState<string | null>(null);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const selectedFile = file;
    if (!selectedFile || uploading || optimizing) return;

    setResult(null);
    setMessage(null);
    setUploadedPath(null);
    setOptimizationSkippedToast(null);
    setThumbFailedToast(null);
    setOptimizing(true);

    let fileToUpload: File;
    let thumbFile: File | null = null;
    try {
      const { optimizedFile, thumbFile: t } = await prepareUploadImages(selectedFile, {
        maxSide: UPLOAD_OPTIMIZE_MAX_SIDE,
        maxBytes: UPLOAD_OPTIMIZE_MAX_BYTES,
        thumbMaxSide: THUMB_MAX_SIDE,
        thumbMaxBytes: THUMB_MAX_BYTES,
      });
      fileToUpload = optimizedFile;
      const isImage = (selectedFile.type ?? "").trim().toLowerCase().startsWith("image/");
      if (isImage && fileToUpload === selectedFile) {
        setOptimizationSkippedToast(
          "Slika se nije mogla optimizirati; učitavamo original."
        );
      }
      if (t.size < fileToUpload.size) thumbFile = t;
    } finally {
      setOptimizing(false);
    }

    setUploading(true);

    const contentType =
      fileToUpload.type && fileToUpload.type.trim()
        ? fileToUpload.type.trim()
        : "application/octet-stream";

    try {
      // Request temp path (no albumId) so promote can copy temp -> album and insert into gallery_images
      const postRes = await fetch("/api/gallery/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          filename: fileToUpload.name,
          fileSize: fileToUpload.size,
          contentType,
        }),
      });

      const postData = await postRes.json().catch(() => ({}));

      if (!postRes.ok) {
        if (postRes.status === 403 && postData?.error === "quota_exceeded") {
          setResult("error");
          setMessage("Premašili ste dopušteni prostor za slike.");
        } else {
          setResult("error");
          setMessage(uploadErrorMessage(postRes.status, postData?.error));
        }
        setUploading(false);
        return;
      }

      const { signedUrl, path } = postData as UploadUrlApiResponse;
      if (!signedUrl || !path) {
        setResult("error");
        setMessage("Neispravan odgovor poslužitelja. Pokušajte ponovno.");
        setUploading(false);
        return;
      }

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: fileToUpload,
      });

      if (putRes.status !== 200 && putRes.status !== 201) {
        setResult("error");
        setMessage(
          `Prijenos datoteke nije uspio. Pokušajte ponovno. (greška ${putRes.status})`
        );
        setUploading(false);
        return;
      }

      // Promote: copy temp -> album, insert into gallery_images (requires gallery_session; cookies sent by default)
      const promoteRes = await fetch("/api/gallery/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempPath: path,
          albumId,
          sizeBytes: fileToUpload.size,
          contentType,
        }),
      });
      const promoteData = await promoteRes.json().catch(() => ({}));

      if (!promoteRes.ok) {
        setResult("error");
        setMessage(
          "Dodavanje slike u album nije uspjelo. Pokušajte ponovno."
        );
        setUploadedPath(path);
        setUploading(false);
        return;
      }

      const imageId =
        typeof promoteData?.imageId === "string"
          ? promoteData.imageId.trim()
          : null;
      const thumbStoragePath =
        imageId && thumbFile
          ? `${ownerId}/${albumId}/${imageId}_thumb.jpg`
          : null;

      if (thumbStoragePath && thumbFile) {
        try {
          const thumbPostRes = await fetch("/api/gallery/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerId,
              filename: thumbFile.name,
              fileSize: thumbFile.size,
              contentType: "image/jpeg",
              customPath: thumbStoragePath,
            }),
          });
          const thumbPostData = await thumbPostRes.json().catch(() => ({}));
          if (
            thumbPostRes.ok &&
            thumbPostData?.signedUrl &&
            thumbPostData?.path
          ) {
            const thumbPutRes = await fetch(thumbPostData.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": "image/jpeg" },
              body: thumbFile,
            });
            if (thumbPutRes.status === 200 || thumbPutRes.status === 201) {
              const supabase = createSupabaseBrowserClient();
              console.log("THUMB DEBUG - attempting update", { imageId, ownerId, thumbStoragePath });
              const { error } = await supabase
                .from("gallery_images")
                .update({ storage_key_thumb: thumbStoragePath })
                .eq("id", imageId)
                .eq("owner_id", ownerId);
              if (error) {
                console.error("THUMB DEBUG - update failed", error);
              } else {
                console.log("THUMB DEBUG - update success");
              }
              if (error) {
                setThumbFailedToast(
                  "Minijatura je spremljena, ali nije povezana; slika je dodana."
                );
              }
            } else {
              setThumbFailedToast(
                "Minijaturu nije moguće učitati; slika je dodana."
              );
            }
          } else {
            setThumbFailedToast(
              "Minijaturu nije moguće učitati; slika je dodana."
            );
          }
        } catch {
          setThumbFailedToast(
            "Minijaturu nije moguće spremiti; slika je dodana."
          );
        }
      }

      setResult("success");
      setMessage("Slika je uspješno dodana u album.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setResult("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Došlo je do neočekivane greške. Pokušajte ponovno."
      );
    } finally {
      setUploading(false);
    }
  }

  const hasFile = !!file;
  const disabled = !hasFile || uploading || optimizing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj slike u album</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {optimizationSkippedToast && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertDescription>{optimizationSkippedToast}</AlertDescription>
          </Alert>
        )}
        {thumbFailedToast && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertDescription>{thumbFailedToast}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading || optimizing}
            className="max-w-xs"
          />
          <Button onClick={handleUpload} disabled={disabled}>
            {optimizing
              ? "Optimiziram sliku…"
              : uploading
                ? "Učitavam…"
                : "Učitaj"}
          </Button>
        </div>

        {result === "success" && message && (
          <Alert>
            <AlertTitle>Uspjeh</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {result === "error" && message && (
          <Alert variant="destructive">
            <AlertTitle>Greška</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
