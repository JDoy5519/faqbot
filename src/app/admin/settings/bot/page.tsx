"use client";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function BotSettingsPage() {
  const [botId, setBotId] = useState("");
  const [name, setName] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [retrievalK, setRetrievalK] = useState(6);
  const [maxTokens, setMaxTokens] = useState(400);
  const [citeOn, setCiteOn] = useState(true);

  async function load() {
    if (!botId) return toast.error("Enter Bot ID");
    const res = await fetch(`/api/admin/settings/bot?bot_id=${botId}`);
    const j = await res.json();
    if (!j.ok) return toast.error(j.error || "Failed to load");
    setName(j.bot.name ?? "");
    setModel(j.bot.model ?? "gpt-4o-mini");
    setRetrievalK(j.bot.retrieval_k ?? 6);
    setMaxTokens(j.bot.max_tokens ?? 400);
    setCiteOn(Boolean(j.bot.cite_on));
  }

  async function save() {
    if (!botId) return toast.error("Enter Bot ID");
    const res = await fetch(`/api/admin/settings/bot`, {
      method: "POST",
      headers: { "content-type":"application/json" },
      body: JSON.stringify({ bot_id: botId, name, model, retrieval_k: retrievalK, max_tokens: maxTokens, cite_on: citeOn }),
    });
    const j = await res.json();
    if (!j.ok) return toast.error(j.error || "Failed to save");
    toast.success("Bot saved");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Bot Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Bot ID" value={botId} onChange={e=>setBotId(e.target.value)} />
            <Button onClick={load}>Load</Button>
          </div>
          <Input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <Input placeholder="Model" value={model} onChange={e=>setModel(e.target.value)} />
          <Input type="number" placeholder="Retrieval k" value={retrievalK} onChange={e=>setRetrievalK(Number(e.target.value))} />
          <Input type="number" placeholder="Max tokens" value={maxTokens} onChange={e=>setMaxTokens(Number(e.target.value))} />
          <div className="flex items-center gap-2">
            <Switch checked={citeOn} onCheckedChange={setCiteOn} />
            <span>Show citations</span>
          </div>
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
