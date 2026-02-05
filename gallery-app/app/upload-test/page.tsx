"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { prepareUploadImage } from "@/lib/images/prepareUploadImage";

type Status = "idle" | "optimizing" | "uploading" | "success" | "error";

const UPLOAD_OPTIMIZE_MAX_SIDE = 2000;
const UPLOAD_OPTIMIZE_MAX_BYTES = 5 * 1024 * 1024;

type DebugInfo = {
  file: { name: string; type: string; size: number } | null;
  post: { status: number; contentType: string; body: string } | null;
  put: { status: number; body: string } | null;
  error: { message: string; stack?: string } | null;
};

const TEST_ALBUM_ID = "00000000-0000-0000-0000-000000000000";

const emptyDebug: DebugInfo = {
  file: null,
  post: null,
  put: null,
  error: null,
};

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

export default function UploadTestPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [debug, setDebug] = useState<DebugInfo>(emptyDebug);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [clientFetchError, setClientFetchError] = useState<string>("");
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anonKey) {
      setAuthChecked(true);
      return;
    }
    const supabase = createClient(url, anonKey);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setUserId(user?.id ?? null);
      } catch {
        if (!cancelled) setUserId(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setFileAndDebug(file: File | null) {
    setSelectedFile(file);
    setDebug((prev) => ({
      ...prev,
      file: file ? { name: file.name, type: file.type, size: file.size } : null,
    }));
  }

  async function handleUpload() {
    const file = selectedFile;
    if (!file) {
      setStatus("error");
      setErrorMessage("Please select a file.");
      setDebug({ ...emptyDebug, error: { message: "Please select a file." } });
      return;
    }
    if (!userId) {
      setStatus("error");
      setErrorMessage("Niste prijavljeni. Za prijenos se morate prijaviti.");
      setDebug({
        ...emptyDebug,
        error: { message: "Niste prijavljeni. Za prijenos se morate prijaviti." },
      });
      return;
    }

    setStatus("optimizing");
    setErrorMessage("");
    setClientFetchError("");
    setDebug({
      ...emptyDebug,
      file: { name: file.name, type: file.type, size: file.size },
    });

    let fileToUpload: File;
    try {
      fileToUpload = await prepareUploadImage(file, {
        maxSide: UPLOAD_OPTIMIZE_MAX_SIDE,
        maxBytes: UPLOAD_OPTIMIZE_MAX_BYTES,
      });
    } finally {
      setStatus("uploading");
    }

    setDebug((prev) => ({
      ...prev,
      file: { name: fileToUpload.name, type: fileToUpload.type, size: fileToUpload.size },
    }));

    try {
      // Step 1: Get signed upload URL from our API (API expects snake_case)
      let res: Response;
      try {
        res = await fetch("/api/gallery/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerId: userId,
            owner_id: userId,
            album_id: TEST_ALBUM_ID,
            filename: fileToUpload.name,
            content_type: fileToUpload.type,
            size_bytes: fileToUpload.size,
          }),
        });
      } catch (fetchErr) {
        const msg =
          (fetchErr instanceof Error ? fetchErr.message : "") || String(fetchErr);
        setClientFetchError(msg);
        throw fetchErr;
      }

      const raw = await res.text();
      const postContentType = res.headers.get("content-type") ?? "";
      setDebug((prev) => ({
        ...prev,
        post: { status: res.status, contentType: postContentType, body: raw },
      }));

      if (!res.ok) {
        let displayMessage = `Request failed: ${res.status}`;
        try {
          const parsed = JSON.parse(raw) as { message?: string; details?: string };
          if (parsed != null && typeof parsed.message === "string") {
            displayMessage =
              `SERVER ERROR (status ${res.status}): ${parsed.message}` +
              (typeof parsed.details === "string" && parsed.details
                ? "\n" + parsed.details
                : "");
          }
        } catch {
          displayMessage = raw || displayMessage;
        }
        throw new Error(displayMessage);
      }

      let data: { signedUrl?: string; path?: string };
      try {
        data = JSON.parse(raw) as { signedUrl?: string; path?: string };
      } catch {
        throw new Error("Invalid JSON in response");
      }

      const signedUrl = data.signedUrl ?? "";
      if (!signedUrl) throw new Error("No signedUrl in response");

      // Step 2: Upload file to signed URL via PUT
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": fileToUpload.type || "application/octet-stream" },
        body: fileToUpload,
      });

      const putBodyRaw = await putRes.text();
      setDebug((prev) => ({
        ...prev,
        put: { status: putRes.status, body: putBodyRaw },
      }));

      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`);
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Unknown error";
      const stack = err instanceof Error ? err.stack : undefined;
      setErrorMessage(message);
      setDebug((prev) => ({
        ...prev,
        error: { message, stack },
      }));
    }
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setErrorMessage("");
    const items = e.dataTransfer.files;
    if (!items?.length) return;
    const file = items[0];
    if (!isImageType(file.type)) {
      setStatus("error");
      setErrorMessage("Only image files are accepted.");
      setDebug({ ...emptyDebug, error: { message: "Only image files are accepted." } });
      return;
    }
    setFileAndDebug(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileAndDebug(file);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Upload test (MVP)</h1>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-hidden
          onChange={handleFileInputChange}
        />

        <div
          role="button"
          tabIndex={0}
          className={`flex min-h-[120px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
            isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/40 bg-muted/30"
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          Drop an image here or click to choose
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-md border border-border bg-muted/50 px-4 py-3 text-sm font-medium hover:bg-muted"
        >
          Choose image
        </button>

        <button
          type="button"
          onClick={handleUpload}
          disabled={status === "optimizing" || status === "uploading" || !selectedFile || !userId}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Upload
        </button>

        {authChecked && !userId && (
          <p className="text-sm text-amber-600">
            Niste prijavljeni. Za prijenos se morate prijaviti.
          </p>
        )}

        {clientFetchError && (
          <p className="text-sm text-red-600">
            CLIENT FETCH ERROR: {clientFetchError}
          </p>
        )}

        {!selectedFile && (
          <p className="text-sm text-muted-foreground">Select an image first.</p>
        )}

        <p className="text-sm text-muted-foreground">
          {selectedFile
            ? `Selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`
            : "No image selected"}
        </p>

        <p className="text-sm text-muted-foreground">
          {status === "optimizing" && "Optimizing image…"}
          {status === "uploading" && "Uploading..."}
          {status === "success" && "Upload successful"}
          {status === "error" && (
            <span className="whitespace-pre-wrap text-destructive">
              {errorMessage}
            </span>
          )}
        </p>
      </div>
    </main>
  );
}
