"use client";

import { m, useInView } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";

import { useEntrance } from "@/hooks/useEntrance";
import { useIsomorphicLayoutEffect } from "@/hooks/useIsomorphicLayoutEffect";

/**
 * Reveals its children in sequence the first time the group scrolls into view.
 *
 * A client island so the pages that use it stay Server Components: only the
 * wrapper ships JavaScript, not the copy inside it.
 *
 * `once: true` — a section that re-animates every time it scrolls past turns
 * reading the page into a light show. The margin starts the sequence slightly
 * before the group reaches the viewport, so it is already settled by the time
 * it is properly on screen.
 *
 * Until it has mounted this renders a plain div. That is the whole point:
 * Motion writes `initial` into the markup, so rendering the animated element on
 * the server would ship every headline on the page at `opacity: 0` — invisible
 * to anyone without JavaScript, and to a crawler reading the HTML. The swap
 * happens in a layout effect, before the browser paints, so nothing flashes.
 */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  /*
   * The observed element is held in state rather than a plain ref, because the
   * element is replaced when this mounts (plain div -> animated div). With a
   * `useRef`, the observer stays attached to the discarded node, never reports
   * an intersection, and the section is hidden for good. Keying the ref object
   * to the node re-runs the observer against whichever element is live.
   */
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const ref = useMemo(() => ({ current: node }), [node]);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const { container } = useEntrance();

  const [mounted, setMounted] = useState(false);
  useIsomorphicLayoutEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div ref={setNode} className={className}>
        {children}
      </div>
    );
  }

  return (
    <m.div
      ref={setNode}
      variants={container}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </m.div>
  );
}

/**
 * One member of a `Reveal` group.
 *
 * Split from the group so the sequence order is the DOM order — whoever edits
 * the page decides what arrives first by where they put it, not by passing
 * indices around.
 */
export function RevealItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const { item } = useEntrance();
  const Component = as === "li" ? m.li : m.div;

  return (
    <Component variants={item} className={className}>
      {children}
    </Component>
  );
}
