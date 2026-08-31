"use client";

import { m, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { SPRING_TILT } from "@/lib/motion/tokens";

/** Degrees of rotation at the far edge of the card. Deliberately small. */
const MAX_TILT_DEGREES = 9;

/**
 * Whether the tilt should run at all.
 *
 * False on touch screens — there is no hover to track, and a tilt that only
 * fires mid-tap reads as a glitch — and false when the viewer has asked for
 * reduced motion. Resolved after mount, because both answers need `window`.
 *
 * `prefers-reduced-motion` is read here rather than relying on the global CSS
 * block, which zeroes CSS durations and has no effect on transforms Motion
 * writes from JavaScript.
 */
function useTiltEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

    const evaluate = () => setEnabled(fine.matches && !reduced.matches);
    evaluate();

    reduced.addEventListener("change", evaluate);
    fine.addEventListener("change", evaluate);
    return () => {
      reduced.removeEventListener("change", evaluate);
      fine.removeEventListener("change", evaluate);
    };
  }, []);

  return enabled;
}

/**
 * How far the pointer is from the card's centre, as -0.5..0.5 on each axis.
 * Children read this to offset themselves, which is what separates the layers
 * in depth rather than tilting one flat picture.
 */
const TiltContext = createContext<{ x: number; y: number; active: boolean }>({
  x: 0,
  y: 0,
  active: false,
});

/**
 * The interactive frame: establishes perspective and tracks the pointer.
 *
 * Decorative by design. Nothing here is focusable and nothing depends on
 * hover, so the card's actual content — links, buttons — works identically on
 * a phone, with a keyboard, and with the tilt switched off.
 */
export function CardContainer({
  children,
  className,
  containerClassName,
}: {
  children: ReactNode;
  /** On the tilting inner element. */
  className?: string;
  /** On the outer perspective element. */
  containerClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useTiltEnabled();

  // Motion values update outside React's render cycle, so pointer movement
  // does not re-render the subtree on every frame.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const springX = useSpring(px, SPRING_TILT);
  const springY = useSpring(py, SPRING_TILT);

  // Moving the pointer right should tip the card's right edge away, so rotateY
  // follows x directly while rotateX takes the opposite sign.
  const rotateY = useTransform(springX, [-0.5, 0.5], [-MAX_TILT_DEGREES, MAX_TILT_DEGREES]);
  const rotateX = useTransform(springY, [-0.5, 0.5], [MAX_TILT_DEGREES, -MAX_TILT_DEGREES]);

  // Mirrors the motion values for the children, at React's pace rather than
  // the pointer's: the parallax offsets are a few pixels and do not need
  // per-frame precision.
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // A fresh object here would be a new context value on every render of this
  // component, re-rendering every layer whether the pointer moved or not.
  const tilt = useMemo(
    () => ({ x: offset.x, y: offset.y, active: enabled }),
    [offset.x, offset.y, enabled],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || ref.current === null) return;

      const rect = ref.current.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      px.set(x);
      py.set(y);
      setOffset({ x, y });
    },
    [enabled, px, py],
  );

  const handlePointerLeave = useCallback(() => {
    // Spring back to flat. Because it is a spring and not a tween, leaving
    // mid-tilt continues from wherever the card currently is.
    px.set(0);
    py.set(0);
    setOffset({ x: 0, y: 0 });
  }, [px, py]);

  return (
    <div
      className={cn("flex items-center justify-center", containerClassName)}
      style={{ perspective: "1200px" }}
    >
      <m.div
        ref={ref}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={
          enabled
            ? { rotateX, rotateY, transformStyle: "preserve-3d" }
            : { transformStyle: "preserve-3d" }
        }
        className={cn("relative", className)}
      >
        <TiltContext.Provider value={tilt}>
          {children}
        </TiltContext.Provider>
      </m.div>
    </div>
  );
}

/** The card's surface. Groups the layers; carries no motion of its own. */
export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative [transform-style:preserve-3d]", className)}>
      {children}
    </div>
  );
}

/**
 * One layer of the card, lifted `translateZ` toward the viewer.
 *
 * Depth is what makes the effect read as a card rather than a tilting
 * rectangle: layers at different heights slide past each other as the card
 * turns. The shift is a few pixels, taken from the pointer offset.
 */
export function CardItem({
  children,
  className,
  translateZ = 0,
  as: Component = "div",
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Pixels toward the viewer. Higher layers move more. */
  translateZ?: number;
  as?: "div" | "span" | "p" | "h2" | "h3";
  style?: CSSProperties;
} & Omit<React.HTMLAttributes<HTMLElement>, "style">) {
  const { x, y, active } = useContext(TiltContext);

  // Parallax scales with depth: something held further forward should travel
  // further across the frame than the surface behind it.
  const depth = translateZ / 20;
  const transform = active
    ? `translate3d(${x * depth}px, ${y * depth}px, ${translateZ}px)`
    : undefined;

  return (
    <Component
      className={cn("transition-transform duration-200 ease-out", className)}
      style={{ ...style, ...(transform !== undefined ? { transform } : {}) }}
      {...rest}
    >
      {children}
    </Component>
  );
}
