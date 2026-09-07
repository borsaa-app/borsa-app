"use client";

/**
 * Ayarlar — bildirim eşikleri, e-posta (Gmail), tarama aralığı, veri durumu
 */

import { useSettings } from "@/lib/store/settings";
import { useQuery } from "@tanstack/react-query";
import { testNotificationPermission } from "@/lib/alerts/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { BellRing, CheckCircle2, Mail, ServerCog, ShieldCheck, Timer } from "lucide-react";
import { useEffect, useState } from "react";

interface HealthResponse {
  status: string;
  providers: Record<string, { available: boolean; note: string }>;
  checkedAt: number;
}

export default function SettingsView() {
  const settings = useSettings();
  const { toast } = useToast();
  const [notifyPerm, setNotifyPerm] = useState<string>("");
  const [testSending, setTestSending] = useState(false);

  const health = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("/api/health");
      return res.json();
    },
    staleTime: 60_000,
  });

  const emailStatus = useQuery<{ configured: boolean; note: string }>({
    queryKey: ["email-status"],
    queryFn: async () => {
      const res = await fetch("/api/notify/email");
      return res.json();
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setNotifyPerm(Notification.permission);
  }, []);

  const enableNotify = async () => {
    const perm = await testNotificationPermission();
    setNotifyPerm(perm);
  };

  const sendTestEmail = async () => {
    if (!settings.emailTo) {
      toast({ title: "E-posta adresi girin", variant: "destructive" });
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch("/api/notify/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: settings.emailTo,
          subject: "[BIST AI Terminal] Test Bildirimi",
          text: "Bu bir test bildirimidir. Kâr/zarar uyarılarınız bu adrese gönderilecektir.",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Test e-postası gönderildi", description: "Gelen kutunuzu kontrol edin." });
      } else {
        toast({ title: "Gönderilemedi", description: data.error + " — " + (data.note ?? ""), variant: "destructive" });
      }
    } catch {
      toast({ title: "Bağlantı hatası", variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-4">
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
            desc="Pozisyon maliyetine göre bu kadar düşüşte uyarı verilir (varsayılan -5)."
            value={settings.dropAlertPct}
            min={1}
            max={50}
            onChange={(v) => settings.update({ dropAlertPct: v })}
          />
          <NumberField
            label="Yükseliş alarmı (%)"
            desc="Pozisyon maliyetine göre bu kadar yükselişte bilgi uyarısı verilir."
            value={settings.riseAlertPct}
            min={1}
            max={100}
            onChange={(v) => settings.update({ riseAlertPct: v })}
          />
          <NumberField
            label="Kâr hedefi alarmı (%)"
            desc="Bu kâr seviyesine ulaşınca 'kâr hedefi' uyarısı gönderilir ve momentum kontrolü yapılır."
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
            desc="Canlı fiyatlama kontrol sıklığı. 30-300 saniye arası önerilir (veri kaynağı limitlerine saygı için)."
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
          {/* Tarayıcı */}
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
          {/* Ses */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Sesli uyarı</div>
              <p className="text-xs text-muted-foreground">Kritik uyarılarda kısa bip sesi çalar.</p>
            </div>
            <Switch checked={settings.soundNotify} onCheckedChange={(v) => settings.update({ soundNotify: v })} />
          </div>
          <Separator />
          {/* E-posta */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5" /> E-posta bildirimi (Gmail)
                  {emailStatus.data && (
                    <Badge variant="outline" className={emailStatus.data.configured ? "text-[10px] text-emerald-500 border-emerald-500/30" : "text-[10px] text-amber-500 border-amber-500/30"}>
                      {emailStatus.data.configured ? "Sunucu yapılandırıldı" : "Sunucu yapılandırılmadı"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Zarar başladığında ve kâr hedefine ulaşıldığında e-posta almak için adresinizi girin. Sunucu tarafında Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD) tanımlı olmalıdır; tanımlı değilse e-posta gönderilmez, tarayıcı bildirimleri çalışmaya devam eder.
                </p>
              </div>
              <Switch checked={settings.emailEnabled} onCheckedChange={(v) => settings.update({ emailEnabled: v })} />
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="ornek@gmail.com"
                value={settings.emailTo}
                onChange={(e) => settings.update({ emailTo: e.target.value })}
                className="max-w-xs"
              />
              <Button size="sm" variant="outline" className="h-9 text-xs" onClick={sendTestEmail} disabled={testSending}>
                {testSending ? "Gönderiliyor…" : "Test Gönder"}
              </Button>
            </div>
            {emailStatus.data && !emailStatus.data.configured && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-600 dark:text-amber-500">
                {emailStatus.data.note}
              </p>
            )}
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
                  <div className="font-semibold">{k === "midas" ? "Midas" : "Yahoo Finance — İstanbul Borsası"}</div>
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
          <strong className="text-foreground">Risk uyarısı:</strong> Bu uygulama bir analiz ve izleme aracıdır; yatırım danışmanlığı değildir. Tüm tahminler olasılık ve senaryo bazlıdır; kesin kazanç garantisi içermez. Yatırım kararlarınızı verirken lisanslı bir yatırım danışmanına başvurunuz. BIST verileri borsa saatlerinde ~15 dakikaya kadar gecikmeli olabilir.
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
