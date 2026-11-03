"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * `useLayoutEffect` runs after DOM mutation but *before* the browser paints,
 * which is what you need when an effect must correct what was just rendered
 * without the user seeing the intermediate state. React warns when it is used
 * during server rendering (there is no layout pass), so on the server it falls
 * back to `useEffect`, which never runs there anyway.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
