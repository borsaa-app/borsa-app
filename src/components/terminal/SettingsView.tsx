"use client";

/**
 * Ayarlar — Gmail bağlantısı, Midas bağlantısı, uyarı eşikleri, veri durumu
 */

import { useSettings } from "@/lib/store/settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { testNotificationPermission } from "@/lib/alerts/engine";
import { usePortfolio } from "@/lib/store/portfolio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { BellRing, CheckCircle2, Link2, Mail, Send, ServerCog, ShieldCheck, Timer, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import InstallPrompt from "./InstallPrompt";

interface HealthResponse {
  status: string;
  providers: Record<string, { available: boolean; note: string }>;
  checkedAt: number;
}

interface EmailSettingsResponse {
  configured: boolean;
  email: string | null;
  lossAlert: boolean;
  lossThresholdPct: number;
  profitAlert: boolean;
  profitTargetPct: number;
  dailyReport: boolean;
  hasPassword: boolean;
}

export default function SettingsView() {
  const settings = useSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const positions = usePortfolio((s) => s.positions);
  const [notifyPerm, setNotifyPerm] = useState<string>(() => {
    if (typeof window !== "undefined" && "Notification" in window) return Notification.permission;
    return "";
  });

  // Gmail bağlantı formu
  const [gmailAddr, setGmailAddr] = useState("");
  const [gmailPass, setGmailPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const health = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      return res.json();
    },
    staleTime: 60_000,
  });

  const emailSettings = useQuery<EmailSettingsResponse>({
    queryKey: ["email-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/email");
      return res.json();
    },
  });

  const gmailAddrValue = gmailAddr || (emailSettings.data?.configured ? emailSettings.data.email ?? "" : "");

  const enableNotify = async () => {
    const perm = await testNotificationPermission();
    setNotifyPerm(perm);
  };

  const saveGmail = async () => {
    if (!gmailAddr || !gmailPass) {
      toast({ title: "Eksik bilgi", description: "E-posta adresi ve Uygulama Şifresi ikisi de gerekli.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: gmailAddr,
          appPassword: gmailPass.replace(/\s/g, ""),
          lossAlert: true,
          lossThresholdPct: settings.dropAlertPct,
          profitAlert: true,
          profitTargetPct: settings.targetAlertPct,
          dailyReport: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Gmail bağlandı ✅", description: "Düşüş, kâr hedefi ve günlük rapor e-postaları bu adrese gelecek. Sayfayı kapatmış olsanız bile gönderilir." });
        setGmailPass("");
        qc.invalidateQueries({ queryKey: ["email-settings"] });
      } else {
        toast({ title: "Kaydedilemedi", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Bağlantı hatası", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/notify/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) toast({ title: "Test e-postası gönderildi ✅", description: data.note });
      else toast({ title: "Gönderilemedi", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Bağlantı hatası", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const sendReportNow = async () => {
    setSendingReport(true);
    try {
      const res = await fetch("/api/notify/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: positions.map((p) => ({ symbol: p.symbol, quantity: p.quantity, avgCost: p.avgCost })) }),
      });
      const data = await res.json();
      if (res.ok) toast({ title: "Rapor gönderildi ✅", description: data.note });
      else toast({ title: "Gönderilemedi", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Bağlantı hatası", variant: "destructive" });
    } finally {
      setSendingReport(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Gmail bağlantısı */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5 text-emerald-500" /> E-POSTA — GMAIL
            {emailSettings.data?.configured && (
              <Badge variant="outline" className="text-[9px] text-emerald-500 border-emerald-500/30">
                <CheckCircle2 className="me-0.5 h-2.5 w-2.5" />Bagli
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Gmail baglayin; dusus, kar hedefi ve gunluk rapor otomatik gelsin. Sifre <b>AES-256</b> ile sifreli saklanir.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-0.5">
              <Label className="text-[10px]">Gmail</Label>
              <Input type="email" placeholder="ornek@gmail.com" value={gmailAddrValue} onChange={(e) => setGmailAddr(e.target.value)} className="h-7 text-[11px]" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Uygulama Sifresi</Label>
              <Input type="password" placeholder="xxxx xxxx xxxx xxxx" value={gmailPass} onChange={(e) => setGmailPass(e.target.value)} className="h-7 text-[11px]" />
            </div>
          </div>
          <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2 text-[10px] leading-relaxed">
            <b>Sifre nasil alinir?</b> Google Hesabi → Guvenlik → 2 Adimli Dogrulama → Uygulama Sifreleri → "BIST AI"
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={saveGmail} disabled={saving} className="h-7 text-[10px]">
              {saving ? "Kaydediliyor..." : emailSettings.data?.configured ? "Guncelle" : "Bagla"}
            </Button>
            <Button size="sm" variant="outline" onClick={sendTest} disabled={testing || !emailSettings.data?.configured} className="h-7 text-[10px]">
              {testing ? "Gonderiliyor..." : "Test Gonder"}
            </Button>
            <Button size="sm" variant="outline" onClick={sendReportNow} disabled={sendingReport || !emailSettings.data?.configured} className="h-7 text-[10px]">
              <Send className="me-0.5 h-2.5 w-2.5" /> {sendingReport ? "Gonderiliyor..." : "Rapor Gonder"}
            </Button>
          </div>
          <Separator />
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span>Zarar e-postasi (%{settings.dropAlertPct})</span>
              <span className="text-muted-foreground">{emailSettings.data?.lossAlert !== false ? "Aktif" : "Kapali"}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span>Kar hedefi e-postasi (%{settings.targetAlertPct})</span>
              <span className="text-muted-foreground">{emailSettings.data?.profitAlert !== false ? "Aktif" : "Kapali"}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span>Gunluk rapor (10:00)</span>
              <span className="text-muted-foreground">{emailSettings.data?.dailyReport !== false ? "Aktif" : "Kapali"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uyarı eşikleri */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <BellRing className="h-3.5 w-3.5 text-amber-500" /> UYARI ESIKLERI
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <NumberField label="Dusus alarmi (%)" desc="Pozisyona gore dususte uyari" value={settings.dropAlertPct} min={1} max={50} onChange={(v) => settings.update({ dropAlertPct: v })} />
          <NumberField label="Kar hedefi (%)" desc="Kar seviyesinde uyari" value={settings.targetAlertPct} min={2} max={200} onChange={(v) => settings.update({ targetAlertPct: v })} />
          <NumberField label="Cooldown (dk)" desc="Ayni uyari tekrar suresi" value={settings.cooldownMinutes} min={5} max={720} onChange={(v) => settings.update({ cooldownMinutes: v })} />
          <NumberField label="Tarama (sn)" desc="Fiyat kontrol araligi" value={settings.pollingSeconds} min={30} max={600} onChange={(v) => settings.update({ pollingSeconds: v })} />
          <NumberField label="Min yatirim (TL)" desc="Pozisyon alt siniri" value={settings.minInvestment} min={1} max={100000} onChange={(v) => settings.update({ minInvestment: v })} />
        </CardContent>
      </Card>

      {/* Bildirim kanalları */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <ServerCog className="h-3.5 w-3.5 text-sky-500" /> BILDIRIMLER
            <InstallPrompt />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium">Tarayici / Telefon</div>
              <p className="text-[10px] text-muted-foreground">PWA ile uygulama gibi kullanilir.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch checked={settings.browserNotify} onCheckedChange={(v) => settings.update({ browserNotify: v })} />
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={enableNotify}>Izin</Button>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium">Sesli uyari</div>
              <p className="text-[10px] text-muted-foreground">Kritik uyarilarda bip.</p>
            </div>
            <Switch checked={settings.soundNotify} onCheckedChange={(v) => settings.update({ soundNotify: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Veri durumu */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> VERI KAYNAGI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-[10px]">
          {health.isLoading ? (
            <p className="text-muted-foreground">Kontrol...</p>
          ) : health.data ? (
            Object.entries(health.data.providers).map(([k, v]) => (
              <div key={k} className="flex items-start gap-1.5 rounded-md border p-2">
                <span className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${v.available ? "bg-emerald-500" : "bg-red-500"}`} />
                <div>
                  <div className="font-semibold">{k === "midas" ? "Midas" : k === "tradingview" ? "TradingView" : "Yahoo Finance"}</div>
                  <p className="text-muted-foreground">{v.note}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-red-500">Kontrol yapilamadi.</p>
          )}
        </CardContent>
      </Card>

      {/* Yasal uyarı */}
      <Card>
        <CardContent className="p-2.5 text-[10px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Risk uyaris:</strong> Bu uygulama analiz aracidir; yatirim danismanligi degildir.
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({ label, desc, value, min, max, onChange }: { label: string; desc: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px]">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="max-w-[120px] h-7 text-[11px]"
      />
      <p className="text-[9px] text-muted-foreground">{desc}</p>
    </div>
  );
}
