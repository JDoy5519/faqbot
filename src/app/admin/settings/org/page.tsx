"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OrgSettingsPage() {
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);

  async function load() {
    if (!orgId) return toast.error("Enter Org ID");
    const res = await fetch(`/api/admin/settings/org?org_id=${orgId}`);
    const j = await res.json();
    if (!j.ok) return toast.error(j.error || "Failed to load");
    setName(j.org.name ?? "");
    setSlug(j.org.slug ?? "");
    setWebhookUrl(j.org.webhook_url ?? "");
    setApiKey(j.org.api_key ?? null);
  }

  async function save(rotate=false) {
    if (!orgId) return toast.error("Enter Org ID");
    const res = await fetch(`/api/admin/settings/org`, {
      method: "POST",
      headers: { "content-type":"application/json" },
      body: JSON.stringify({ org_id: orgId, name, slug, webhook_url: webhookUrl, rotate_api_key: rotate }),
    });
    const j = await res.json();
    if (!j.ok) return toast.error(j.error || "Failed to save");
    setApiKey(j.org.api_key ?? null);
    toast.success(rotate ? "API key rotated" : "Settings saved");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Organization Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Org ID" value={orgId} onChange={e=>setOrgId(e.target.value)} />
            <Button onClick={load}>Load</Button>
          </div>
          <Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <Input placeholder="Slug (for hosted page)" value={slug} onChange={e=>setSlug(e.target.value)} />
          <Input placeholder="Webhook URL (optional)" value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={()=>save(false)}>Save</Button>
            <Button variant="secondary" onClick={()=>save(true)}>Rotate API Key</Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Current API key: <span className="font-mono">{apiKey ?? "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
