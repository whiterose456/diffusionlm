import { useEffect, useRef, useState, type ReactNode } from "react";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ── scramble-decode text ─────────────────────────────────── */
const GLYPHS = "∂∇Σεβᾱπλξ≈01<>/*+#";

export function Scramble({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [out, setOut] = useState(() => (prefersReducedMotion() ? text : ""));
  const frame = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setOut(text);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const dur = 950;
    const tick = (now: number) => {
      if (start === null) start = now + delay;
      const el = now - start;
      if (el < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, el / dur);
      const resolved = Math.floor(p * text.length);
      frame.current++;
      let s = text.slice(0, resolved);
      for (let i = resolved; i < text.length; i++) {
        s += text[i] === " " ? " " : GLYPHS[(frame.current * 7 + i * 3) % GLYPHS.length];
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay]);

  return (
    <span className={className} aria-label={text}>
      {out || "\u00A0"}
    </span>
  );
}

/* ── scroll reveal wrapper ────────────────────────────────── */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "figure" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${inView ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/* ── in-view hook for charts ──────────────────────────────── */
export function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}
