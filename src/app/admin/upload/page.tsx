"use client";

import React, { useCallback, useRef, useState } from "react";

type UploadItem = {
  file: File;
  progress: number; // 0..100
  status: "idle" | "uploading" | "processing" | "done" | "error";
  message?: string;
  resultUrl?: string | null;
  documentId?: string;
};

export default function AdminUploadPage() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [botId, setBotId] = useState<string>(""); // optional

  const onPick = useCallback((files: FileList | null) => {
    if (!files) return;
    const next: UploadItem[] = [];
    for (const f of Array.from(files)) {
      next.push({ file: f, progress: 0, status: "idle" });
    }
    setItems(next);
  }, []);

  const validate = (f: File) => {
    if (f.type !== "application/pdf") {
      return "Only PDF files are allowed.";
    }
    const max = 50 * 1024 * 1024;
    if (f.size > max) {
      return `File too large. Max 50MB.`;
    }
    return null;
  };

  const processDoc = async (docId: string, index: number) => {
    setItems((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], status: "processing", message: "Processing…" };
      return clone;
    });

    const res = await fetch("/api/admin/uploads/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: docId }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setItems((prev) => {
        const clone = [...prev];
        clone[index] = { ...clone[index], status: "error", message: error || "Processing failed" };
        return clone;
      });
      return;
    }

    const data = await res.json();
    setItems((prev) => {
      const clone = [...prev];
      clone[index] = {
        ...clone[index],
        status: "done",
        message: `Processed ${data.chunks_inserted} chunks`,
      };
      return clone;
    });
  };

  const uploadOne = (it: UploadItem, index: number) =>
    new Promise<void>((resolve) => {
      const err = validate(it.file);
      if (err) {
        setItems((prev) => {
          const clone = [...prev];
          clone[index] = { ...clone[index], status: "error", message: err, progress: 0 };
          return clone;
        });
        return resolve();
      }

      const form = new FormData();
      form.append("files", it.file);
      if (botId.trim()) form.append("bot_id", botId.trim());

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/uploads");
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setItems((prev) => {
          const clone = [...prev];
          clone[index] = { ...clone[index], progress: pct, status: "uploading" };
          return clone;
        });
      };
      xhr.onreadystatechange = async () => {
        if (xhr.readyState !== 4) return;
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const json = JSON.parse(xhr.responseText);
            const url = json?.files?.[0]?.publicUrl ?? null;
            const docId = json?.files?.[0]?.id as string | undefined;

            setItems((prev) => {
              const clone = [...prev];
              clone[index] = {
                ...clone[index],
                status: "processing",
                progress: 100,
                resultUrl: url,
                documentId: docId,
                message: "Processing…",
              };
              return clone;
            });

            if (docId) {
              await processDoc(docId, index);
            } else {
              setItems((prev) => {
                const clone = [...prev];
                clone[index] = {
                  ...clone[index],
                  status: "error",
                  message: "Missing document_id from upload response",
                };
                return clone;
              });
            }
            resolve();
          } else {
            const msg = (() => {
              try {
                return JSON.parse(xhr.responseText)?.error || `HTTP ${xhr.status}`;
              } catch {
                return `HTTP ${xhr.status}`;
              }
            })();
            setItems((prev) => {
              const clone = [...prev];
              clone[index] = { ...clone[index], status: "error", message: msg };
              return clone;
            });
            resolve();
          }
        } catch (err: any) {
          setItems((prev) => {
            const clone = [...prev];
            clone[index] = { ...clone[index], status: "error", message: err?.message || "Error" };
            return clone;
          });
          resolve();
        }
      };
      xhr.send(form);
    });

  const onUploadAll = useCallback(async () => {
    for (let i = 0; i < items.length; i++) {
      await uploadOne(items[i], i);
    }
  }, [items]);

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    onPick(files);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Upload & Process PDFs</h1>

      <div className="space-y-2">
        <label className="block text-sm text-gray-600">Optional Bot ID</label>
        <input
          value={botId}
          onChange={(e) => setBotId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer"
        onClick={() => inputRef.current?.click()}
      >
        <p className="mb-2 font-medium">Drag & drop PDFs here</p>
        <p className="text-sm text-gray-600">or click to choose files</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => onPick(e.target.files)}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={onUploadAll}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
            disabled={items.some((i) => i.status === "uploading" || i.status === "processing")}
          >
            Upload {items.length} file{items.length > 1 ? "s" : ""}
          </button>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{it.file.name}</div>
                  <div className="text-sm text-gray-500">
                    {(it.file.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>

                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-600 transition-all"
                    style={{ width: `${it.progress}%` }}
                  />
                </div>

                <div className="mt-2 text-sm">
                  {it.status === "idle" && <span>Ready</span>}
                  {it.status === "uploading" && <span>Uploading… {it.progress}%</span>}
                  {it.status === "processing" && <span className="animate-pulse">Processing…</span>}
                  {it.status === "done" && (
                    <span className="text-green-700">✅ {it.message} {it.resultUrl ? (
                      <>
                        –{" "}
                        <a className="underline" href={it.resultUrl} target="_blank" rel="noreferrer">
                          open
                        </a>
                      </>
                    ) : null}</span>
                  )}
                  {it.status === "error" && <span className="text-red-700">⚠ {it.message || "Error"}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}




