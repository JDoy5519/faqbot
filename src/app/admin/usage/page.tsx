"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Row = {
  org_id: string;
  bot_id: string | null;
  day: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_cents: number;
};

export default function UsagePage() {
  const [orgId, setOrgId] = useState<string>("");
  const [botId, setBotId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    if (!orgId) { toast.error("Enter an Org ID"); return; }
    const qs = new URLSearchParams({ org_id: orgId });
    if (botId) qs.set("bot_id", botId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/admin/usage/daily?${qs.toString()}`);
    const j = await res.json();
    if (!j.ok) { toast.error(j.error || "Failed to load"); return; }
    setRows(j.rows || []);
  }

  function exportCsv() {
    if (!orgId) { toast.error("Enter an Org ID"); return; }
    const qs = new URLSearchParams({ org_id: orgId });
    if (botId) qs.set("bot_id", botId);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    window.location.href = `/api/admin/usage/export?${qs.toString()}`;
  }

  useEffect(()=>{},[]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input placeholder="Org ID" value={orgId} onChange={e=>setOrgId(e.target.value)} />
            <Input placeholder="Bot ID (optional)" value={botId} onChange={e=>setBotId(e.target.value)} />
            <Input placeholder="From (YYYY-MM-DD)" value={from} onChange={e=>setFrom(e.target.value)} />
            <Input placeholder="To (YYYY-MM-DD)" value={to} onChange={e=>setTo(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={load}>Load</Button>
              <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            </div>
          </div>

          <div className="border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2">Day</th>
                  <th className="text-left p-2">Bot</th>
                  <th className="text-right p-2">Prompt</th>
                  <th className="text-right p-2">Completion</th>
                  <th className="text-right p-2">Total</th>
                  <th className="text-right p-2">Cost (£)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={`${r.day}_${r.bot_id}`} className="border-t">
                    <td className="p-2">{r.day}</td>
                    <td className="p-2">{r.bot_id ?? "-"}</td>
                    <td className="p-2 text-right">{r.prompt_tokens}</td>
                    <td className="p-2 text-right">{r.completion_tokens}</td>
                    <td className="p-2 text-right">{r.total_tokens}</td>
                    <td className="p-2 text-right">{(r.cost_cents/100).toFixed(2)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td className="p-4 text-muted-foreground" colSpan={6}>No usage in range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
