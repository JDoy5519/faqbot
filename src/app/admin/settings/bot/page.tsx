"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type BotRow = {
  id: string;
  name: string | null;
  model: string | null;
  retrieval_k: number | null;
  max_tokens: number | null;
  cite_on: boolean | null;
  public_token?: string | null;
  is_active?: boolean | null;
};

export default function BotSettingsPage() {
  const [botId, setBotId] = useState("");
  const [loading, setLoading] = useState(false);

  // editable fields
  const [name, setName] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [retrievalK, setRetrievalK] = useState(6);
  const [maxTokens, setMaxTokens] = useState(400);
  const [citeOn, setCiteOn] = useState(true);

  // token
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const embedSnippet = useMemo(() => {
    const token = publicToken || "REPLACE_WITH_PUBLIC_TOKEN";
    const host = baseUrl || "";
    return [
      `<script>`,
      `  window.FAQBotWidget = { position: "right", theme: "auto", accent: "#2563EB" };`,
      `</script>`,
      `<script src="${host}/api/public/widget?token=${token}"></script>`,
    ].join("\n");
  }, [publicToken, baseUrl]);

  const testEmbedHref = useMemo(() => {
    if (!publicToken) return null;
    return `/public/embed?token=${encodeURIComponent(publicToken)}&theme=light`;
  }, [publicToken]);

  const assignFromBot = (b: Partial<BotRow> | null) => {
    setName((b?.name ?? "") || "");
    setModel((b?.model ?? "gpt-4o-mini") || "gpt-4o-mini");
    setRetrievalK(Number.isFinite(b?.retrieval_k as number) ? (b!.retrieval_k as number) : 6);
    setMaxTokens(Number.isFinite(b?.max_tokens as number) ? (b!.max_tokens as number) : 400);
    setCiteOn(Boolean(b?.cite_on ?? true));
    setPublicToken(b?.public_token ?? null);
  };

  const load = useCallback(async () => {
    if (!botId) return toast.error("Enter Bot ID");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settings/bot?bot_id=${encodeURIComponent(botId)}`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const bot: BotRow = j.bot;
      if (!bot?.id) throw new Error("Bot not found");
      assignFromBot(bot);
      toast.success("Loaded bot");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  const save = useCallback(async () => {
    if (!botId) return toast.error("Enter Bot ID");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settings/bot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          name,
          model,
          retrieval_k: retrievalK,
          max_tokens: maxTokens,
          cite_on: citeOn,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      // if API returns the updated bot, re-bind
      if (j.bot) assignFromBot(j.bot);
      toast.success("Bot saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }, [botId, name, model, retrievalK, maxTokens, citeOn]);

  const rotateToken = useCallback(async () => {
    if (!botId) return toast.error("Enter Bot ID");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settings/bot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          rotate_public_token: true, // server should handle rotation
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      const newToken: string | null =
        j.public_token ?? j.bot?.public_token ?? null;
      setPublicToken(newToken);
      toast.success("Public token rotated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to rotate token");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  const copy = (text: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Copy failed"));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bot Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Load */}
          <div className="flex gap-2">
            <Input
              placeholder="Bot ID"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
            />
            <Button onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Load"}
            </Button>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Name</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-600">Model</div>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-600">Retrieval k</div>
              <Input
                type="number"
                value={retrievalK}
                onChange={(e) => setRetrievalK(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-600">Max tokens</div>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={citeOn} onCheckedChange={setCiteOn} />
            <span className="text-sm">Show citations</span>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Public Token + Embed */}
      <Card>
        <CardHeader>
          <CardTitle>Public Embed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="text-xs text-gray-600">Public Token</div>
            <div className="flex gap-2">
              <Input
                value={publicToken ?? ""}
                readOnly
                placeholder="No token yet"
              />
              <Button
                type="button"
                onClick={() => publicToken && copy(publicToken)}
                disabled={!publicToken}
                variant="secondary"
              >
                Copy
              </Button>
              <Button type="button" onClick={rotateToken} variant="outline" disabled={loading}>
                {publicToken ? "Rotate token" : "Generate token"}
              </Button>
            </div>
            {testEmbedHref ? (
              <div className="text-xs">
                <a className="text-blue-600 underline" href={testEmbedHref} target="_blank" rel="noreferrer">
                  Test embed →
                </a>
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="text-xs text-gray-600">
              Paste this before your site’s closing <code>&lt;/body&gt;</code>:
            </div>
            <pre className="text-xs bg-gray-50 p-3 rounded border overflow-auto">
{embedSnippet}
            </pre>
            <div className="flex gap-2">
              <Button type="button" onClick={() => copy(embedSnippet)} variant="secondary">
                Copy snippet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

