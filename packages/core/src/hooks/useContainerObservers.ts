import { useEffect, useRef, useState } from "react";

/** Track a scroll container's `scrollTop` (rAF-coalesced) and whether it is
 * actively scrolling (resets 150ms after the last scroll event). */
export function useContainerScroll(ref: React.RefObject<HTMLElement | null>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const rafRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        setScrollTop(el.scrollTop);
        setIsScrolling(true);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
        rafRef.current = 0;
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [ref]);

  return { scrollTop, isScrolling };
}

/** Track a container's content-box size via ResizeObserver. */
export function useContainerSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}
