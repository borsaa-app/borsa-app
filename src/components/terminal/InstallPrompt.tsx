"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferred(e)
    }
    window.addEventListener("beforeinstallprompt", handler as EventListener)
    window.addEventListener("appinstalled", () => setInstalled(true))
    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener)
    }
  }, [])

  if (installed || !deferred) return null

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-[10px] gap-1"
      onClick={async () => {
        await deferred.prompt()
        const result = await deferred.userChoice
        if (result.outcome === "accepted") setInstalled(true)
        setDeferred(null)
      }}
    >
      <Download className="h-3 w-3" /> Yükle
    </Button>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}
