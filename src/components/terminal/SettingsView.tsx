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
  const [notifyPerm, setNotifyPerm] = useState<string>("");

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

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setNotifyPerm(Notification.permission);
  }, []);
  useEffect(() => {
    if (emailSettings.data?.configured && emailSettings.data.email) setGmailAddr(emailSettings.data.email);
  }, [emailSettings.data]);

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
    <div className="space-y-4">
      {/* Gmail bağlantısı */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-emerald-500" /> E-POSTA UYARILARI — GMAIL BAĞLANTISI
            {emailSettings.data?.configured && (
              <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                <CheckCircle2 className="me-1 h-3 w-3" />Bağlı: {emailSettings.data.email}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Gmail hesabınızı bağlayın; sistem size otomatik olarak şunları e-posta ile bildirsin:
            <span className="text-foreground"> 🚨 portföy zarara geçtiğinde</span>,
            <span className="text-foreground"> 🎯 kâr hedefine ulaştığınızda</span>,
            <span className="text-foreground"> 📊 her sabah ajanın bugünkü seçimleri + portföy raporu</span>.
            Şifreniz sunucuda <b>AES-256 ile şifreli</b> saklanır, asla görünmez paylaşılmaz.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Gmail adresiniz</Label>
              <Input type="email" placeholder="ornek@gmail.com" value={gmailAddr} onChange={(e) => setGmailAddr(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gmail Uygulama Şifresi (16 hane)</Label>
              <Input type="password" placeholder="xxxx xxxx xxxx xxxx" value={gmailPass} onChange={(e) => setGmailPass(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2.5 text-[11px] leading-relaxed">
            <b>Uygulama Şifresi nasıl alınır?</b> (2 dakika)
            <ol className="mt-1 list-decimal space-y-0.5 ps-5 text-muted-foreground">
              <li>Google Hesabı → Güvenlik → <b>2 Adımlı Doğrulama</b>&apos;yı açın</li>
              <li>Aynı sayfada <b>Uygulama Şifreleri</b>&apos;ne girin</li>
              <li>Uygulama adına &quot;BIST AI&quot; yazıp oluştur → 16 haneli şifreyi yukarıya yapıştırın</li>
            </ol>
            <span className="text-muted-foreground">Normal Gmail şifreniz çalışmaz — güvenlik için Google yalnızca Uygulama Şifresi kabul eder.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveGmail} disabled={saving} className="h-9 text-xs">
              {saving ? "Kaydediliyor…" : emailSettings.data?.configured ? "Bağlantıyı Güncelle" : "Gmail'i Bağla"}
            </Button>
            <Button size="sm" variant="outline" onClick={sendTest} disabled={testing || !emailSettings.data?.configured} className="h-9 text-xs">
              {testing ? "Gönderiliyor…" : "Test E-postası Gönder"}
            </Button>
            <Button size="sm" variant="outline" onClick={sendReportNow} disabled={sendingReport || !emailSettings.data?.configured} className="h-9 text-xs">
              <Send className="me-1 h-3 w-3" /> {sendingReport ? "Gönderiliyor…" : "Raporu Şimdi E-postala"}
            </Button>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span>🚨 Zarar e-postası (eşik: %{settings.dropAlertPct})</span>
              <span className="text-muted-foreground">{emailSettings.data?.lossAlert !== false ? "Aktif" : "Kapalı"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>🎯 Kâr hedefi e-postası (eşik: %{settings.targetAlertPct})</span>
              <span className="text-muted-foreground">{emailSettings.data?.profitAlert !== false ? "Aktif" : "Kapalı"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>📊 Günlük seçim + portföy raporu (her işlem günü 10:00)</span>
              <span className="text-muted-foreground">{emailSettings.data?.dailyReport !== false ? "Aktif" : "Kapalı"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Midas bağlantısı */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-violet-500" /> MIDAS BAĞLANTISI
            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
              <CheckCircle2 className="me-1 h-3 w-3" />Resmî BIST fiyatları aktif
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed">
          <p>
            Bu terminal, <b>resmî Borsa İstanbul fiyatlarını</b> kullanır — Midas uygulamasında gördüğünüz fiyatla
            birebir aynı borsa verisidir (aynı kapanış, aynı gün içi fiyat). Fark görürseniz Midas&apos;taki fiyat
            gecikmeli olabildiği için terminal birkaç saniye daha güncel sayılabilir.
          </p>
          <p className="text-muted-foreground">
            <b>Midas hesap bağlantısı hakkında dürüst bilgi:</b> Midas, müşteri portföyüne erişim için kamuya açık bir API
            sunmamaktadır. Bu yüzden portföyünüzü iki yolla eşitleyebilirsiniz:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border p-2.5">
              <div className="flex items-center gap-1.5 font-semibold"><Wallet className="h-3.5 w-3.5 text-emerald-500" /> 1) Portföy paneline ekle</div>
              <p className="mt-1 text-muted-foreground">Midas&apos;ta tuttuğunuz hisseleri Portföy sekmesine ekleyin (adet + maliyet). Terminal gerçek fiyatlarla anlık K/Z, günlük/haftalık kâr ve uyarıları hesaplar.</p>
            </div>
            <div className="rounded-md border p-2.5">
              <div className="flex items-center gap-1.5 font-semibold"><Mail className="h-3.5 w-3.5 text-sky-500" /> 2) Gmail ile otomatik takip</div>
              <p className="mt-1 text-muted-foreground">Gmail bağlantısı kurun: pozisyonlarınız kaydedilir, her gün sabah portföy durumu + zarar/kâr e-postası otomatik gelir — siteyi açmanız gerekmez.</p>
            </div>
          </div>
          {process.env.NEXT_PUBLIC_MIDAS_KEY_NOTE !== "hidden" && (
            <p className="text-[11px] text-muted-foreground">
              Kurumsal Midas API anahtarınız varsa <code className="rounded bg-muted px-1">MIDAS_API_KEY</code> ortam değişkeniyle doğrudan entegrasyon devreye girer.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Uyarı eşikleri */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BellRing className="h-4 w-4 text-amber-500" /> UYARI EŞİKLERİ
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Düşüş alarmı (%)"
            desc="Pozisyon maliyetine göre bu kadar düşüşte uyarı + e-posta verilir (varsayılan -5)."
            value={settings.dropAlertPct}
            min={1}
            max={50}
            onChange={(v) => settings.update({ dropAlertPct: v })}
          />
          <NumberField
            label="Kâr hedefi alarmı (%)"
            desc="Bu kâr seviyesine ulaşınca 'kâr hedefi' uyarısı + e-posta gönderilir."
            value={settings.targetAlertPct}
            min={2}
            max={200}
            onChange={(v) => settings.update({ targetAlertPct: v })}
          />
          <NumberField
            label="Cooldown (dakika)"
            desc="Aynı uyarı bu süre kadar tekrar gönderilmez (spam koruması)."
            value={settings.cooldownMinutes}
            min={5}
            max={720}
            onChange={(v) => settings.update({ cooldownMinutes: v })}
          />
          <NumberField
            label="Tarama aralığı (saniye)"
            desc="Canlı fiyatlama kontrol sıklığı. 30-300 saniye arası önerilir."
            value={settings.pollingSeconds}
            min={30}
            max={600}
            onChange={(v) => settings.update({ pollingSeconds: v })}
          />
          <NumberField
            label="Minimum yatırım (TL)"
            desc="Pozisyon ekleme alt sınırı. Varsayılan 100 TL."
            value={settings.minInvestment}
            min={1}
            max={100000}
            onChange={(v) => settings.update({ minInvestment: v })}
          />
        </CardContent>
      </Card>

      {/* Bildirim kanalları */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ServerCog className="h-4 w-4 text-sky-500" /> BİLDİRİM KANALLARI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Tarayıcı / Telefon bildirimi (PWA)</div>
              <p className="text-xs text-muted-foreground">Kurulum gerektirmez; site açıkken uyarılar anında iletilir. Telefonda &quot;Ana ekrana ekle&quot; ile uygulama gibi kullanılır.</p>
              {notifyPerm === "granted" && <Badge variant="outline" className="mt-1 text-[10px] text-emerald-500 border-emerald-500/30"><CheckCircle2 className="me-1 h-3 w-3" />İzin verildi</Badge>}
              {notifyPerm === "denied" && <Badge variant="outline" className="mt-1 text-[10px] text-red-500 border-red-500/30">İzin reddedildi — tarayıcı ayarlarından açın</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={settings.browserNotify} onCheckedChange={(v) => settings.update({ browserNotify: v })} />
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={enableNotify}>
                İzin İste
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Sesli uyarı</div>
              <p className="text-xs text-muted-foreground">Kritik uyarılarda kısa bip sesi çalar.</p>
            </div>
            <Switch checked={settings.soundNotify} onCheckedChange={(v) => settings.update({ soundNotify: v })} />
          </div>
        </CardContent>
      </Card>

      {/* Veri durumu */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> VERİ KAYNAĞI DURUMU
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {health.isLoading ? (
            <p className="text-muted-foreground">Kontrol ediliyor…</p>
          ) : health.data ? (
            Object.entries(health.data.providers).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 rounded-md border p-2.5">
                <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${v.available ? "bg-emerald-500" : "bg-red-500"}`} />
                <div>
                  <div className="font-semibold">{k === "midas" ? "Midas" : k === "tradingview" ? "TradingView — Resmî BIST (Midas ile aynı fiyat)" : "Yahoo Finance — İstanbul Borsası (yedek)"}</div>
                  <p className="text-muted-foreground">{v.note}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-red-500">Sağlık kontrolü yapılamadı.</p>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Timer className="h-3 w-3" />
            Veriler gerçek kaynaklardan gelir; alınamadığında &quot;Veri alınamadı&quot; gösterilir, asla uydurma fiyat/haber üretilmez.
          </div>
        </CardContent>
      </Card>

      {/* Yasal uyarı */}
      <Card>
        <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Risk uyarısı:</strong> Bu uygulama bir analiz ve izleme aracıdır; yatırım danışmanlığı değildir. Tüm hedefler olasılık ve senaryo bazlıdır; kesin kazanç garantisi içermez. Yatırım kararlarınızı verirken lisanslı bir yatırım danışmanına başvurunuz.
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({ label, desc, value, min, max, onChange }: { label: string; desc: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="max-w-[140px]"
      />
      <p className="text-[11px] text-muted-foreground">{desc}</p>
    </div>
  );
}
