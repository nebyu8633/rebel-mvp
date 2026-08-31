"use client";

import { LazyMotion, domAnimation } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Loads Motion's animation features once, for the whole app.
 *
 * `domAnimation` is the subset this product needs — transforms, opacity,
 * gestures — at roughly 5KB, against ~34KB for the full `motion` component.
 * `strict` makes that saving enforceable: with it on, importing `motion.div`
 * anywhere throws instead of silently pulling the full bundle back in. Use
 * `m.div` instead.
 *
 * This wraps the whole tree rather than individual pages so a component can
 * animate wherever it is mounted without each caller remembering the wrapper.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
