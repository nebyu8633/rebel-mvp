"use client";

import { useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";

import { DURATION, EASE_OUT, ENTER_DISTANCE, STAGGER } from "@/lib/motion/tokens";

export interface EntranceVariants {
  /** Put on the group. Orchestrates the children; has no visual of its own. */
  container: Variants;
  /** Put on each child. */
  item: Variants;
}

/**
 * Entrance variants for a group of elements, and the single place where the
 * reduced-motion preference is honoured for JavaScript-driven animation.
 *
 * The CSS block in globals.css cannot do this job: it zeroes
 * `animation-duration` and `transition-duration`, neither of which Motion
 * uses. Without this hook, turning on "reduce motion" would quietly stop
 * working the moment the first Motion component shipped.
 *
 * When motion is reduced the elements are not merely faster — they are still,
 * and start at their final opacity and position. Content is never withheld
 * from someone who asked for less movement.
 */
export function useEntrance(stagger: number = STAGGER): EntranceVariants {
  const reduced = useReducedMotion();

  if (reduced === true) {
    return {
      container: { hidden: {}, visible: {} },
      item: { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } },
    };
  }

  return {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: stagger } },
    },
    item: {
      hidden: { opacity: 0, y: ENTER_DISTANCE },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.base, ease: EASE_OUT },
      },
    },
  };
}
