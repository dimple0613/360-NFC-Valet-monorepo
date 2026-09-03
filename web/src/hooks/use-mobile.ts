import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const update = () => {
      setIsMobile(mql.matches)
    }
    // Hydration-safe: keep the initial static render consistent with the
    // server (isMobile = false, i.e. the desktop side) and only switch to the
    // mobile drawer after mount, when matchMedia is reliable. This removes the
    // React hydration mismatch and the flash-of-wrong-sidebar on small screens.
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

  return isMobile
}
