/**
 * Shared motion tokens.
 *
 * Every animation in the product reads its timing from here. The alternative —
 * each component picking its own duration and easing — is what makes an
 * interface feel assembled rather than designed: two things that happen for
 * the same reason should move at the same speed.
 *
 * Note that these are the *intent*. Whether motion happens at all is decided
 * by `useEntrance`, which returns still variants when the viewer has asked for
 * reduced motion. The global `prefers-reduced-motion` block in globals.css
 * does not cover this: it zeroes CSS durations, and Motion drives transforms
 * from JavaScript, straight past it.
 */

/** Seconds. Motion takes seconds; CSS takes milliseconds — do not mix them. */
export const DURATION = {
  /** Micro-interactions: hover, press, colour changes. */
  fast: 0.18,
  /** The default for anything entering or leaving. */
  base: 0.32,
  /** Reserved for the largest single element on a screen. */
  slow: 0.55,
} as const;

/**
 * Ease-out, weighted heavily toward the start.
 *
 * Things arriving should decelerate into place; something that arrives at a
 * constant speed reads as mechanical.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * The spring for pointer-tracked motion (the 3D card's tilt).
 *
 * A spring rather than a duration because the target moves continuously: a
 * timed tween would restart on every pointer event and stutter. Damped well
 * below critical so it settles without visible overshoot — this is a subtle
 * lean, not a wobble.
 */
export const SPRING_TILT = { stiffness: 150, damping: 18, mass: 0.6 } as const;

/**
 * Delay between consecutive items in a staggered group, in seconds.
 *
 * Material's guidance is 30–50ms; 60ms suits the four-item groups here, where
 * the sequence is short enough that a faster cascade reads as a single event
 * rather than an order.
 */
export const STAGGER = 0.06;

/** How far an entering element travels, in pixels. Small on purpose. */
export const ENTER_DISTANCE = 16;
