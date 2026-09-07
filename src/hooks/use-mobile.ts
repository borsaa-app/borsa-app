import * as React from "react"

const MOBILE_BP = 640
const TABLET_BP = 1024

function getBP(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop"
  const w = window.innerWidth
  return w < MOBILE_BP ? "mobile" : w < TABLET_BP ? "tablet" : "desktop"
}

export function useIsMobile() {
  const [v, setV] = React.useState<boolean>(false)
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`)
    const onChange = () => setV(window.innerWidth < MOBILE_BP)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return v
}

export function useBreakpoint() {
  const [bp, setBp] = React.useState<"mobile" | "tablet" | "desktop">("desktop")
  React.useEffect(() => {
    const onChange = () => setBp(getBP())
    onChange()
    window.addEventListener("resize", onChange)
    return () => window.removeEventListener("resize", onChange)
  }, [])
  return bp
}
