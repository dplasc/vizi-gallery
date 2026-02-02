"use client";

/*
 * Checklist:
 * - Open album page while signed in
 * - Choose file (single file input)
 * - Click Upload
 * - See "Uploading..." then "Uploaded" with path on success
 * - After PUT: calls POST /api/gallery/images to create DB row, then router.refresh()
 * - Error: 403 + { error: "quota_exceeded" } -> "Quota exceeded"
 * - Other POST errors -> generic status/message
 * - PUT failure -> show PUT status
 * - DB insert failure after PUT -> show clear error (storage uploaded, album not updated)
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

type UploadUrlApiResponse = {
  signedUrl: string;
  path: string;
  bucket: string;
};

type Props = {
  ownerId: string;
  albumId: string;
};

export function UploadToAlbumCard({ ownerId, albumId }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const selectedFile = file;
    if (!selectedFile || uploading) return;

    setResult(null);
    setMessage(null);
    setUploadedPath(null);
    setUploading(true);

    const contentType =
      selectedFile.type && selectedFile.type.trim()
        ? selectedFile.type.trim()
        : "application/octet-stream";

    try {
      const postRes = await fetch("/api/gallery/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          albumId,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
          contentType,
        }),
      });

      const postData = await postRes.json().catch(() => ({}));

      if (!postRes.ok) {
        if (postRes.status === 403 && postData?.error === "quota_exceeded") {
          setResult("error");
          setMessage("Quota exceeded");
        } else {
          setResult("error");
          setMessage(
            postData?.error
              ? String(postData.error)
              : `Error ${postRes.status}`
          );
        }
        setUploading(false);
        return;
      }

      const { signedUrl, path } = postData as UploadUrlApiResponse;
      if (!signedUrl || !path) {
        setResult("error");
        setMessage("Invalid response from server");
        setUploading(false);
        return;
      }

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: selectedFile,
      });

      if (putRes.status !== 200 && putRes.status !== 201) {
        setResult("error");
        setMessage(`Upload failed: ${putRes.status}`);
        setUploading(false);
        return;
      }

      const insertRes = await fetch("/api/gallery/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId,
          storagePath: path,
          contentType,
          sizeBytes: selectedFile.size,
          originalName: selectedFile.name,
        }),
      });
      const insertData = await insertRes.json().catch(() => ({}));

      if (!insertRes.ok) {
        setResult("error");
        setMessage(
          insertData?.error
            ? `Slika je učitana, ali nije dodana u album: ${String(insertData.error)}`
            : "Slika je učitana, ali nije dodana u album. Pokušajte osvježiti stranicu."
        );
        setUploadedPath(path);
        setUploading(false);
        return;
      }

      setResult("success");
      setUploadedPath(path);
      setMessage("Uploaded");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setResult("error");
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  const hasFile = !!file;
  const disabled = !hasFile || uploading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload to album</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
            className="max-w-xs"
          />
          <Button onClick={handleUpload} disabled={disabled}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>

        {result === "success" && message && (
          <Alert>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              {message}
              {uploadedPath && (
                <span className="mt-1 block font-mono text-xs">
                  {uploadedPath}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {result === "error" && message && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
