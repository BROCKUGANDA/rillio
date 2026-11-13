import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Initialise from the media query inside a microtask so the effect body
    // does not synchronously cascade a re-render on mount.
    queueMicrotask(onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
