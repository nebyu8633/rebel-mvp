"use client";

import { Float } from "@react-three/drei";
import { useMemo } from "react";

/**
 * The data orbiting the invoice: products, prices, suppliers, savings.
 *
 * Rendered as small geometric tokens rather than readable text — legible
 * numbers here would be fabricated data on a marketing surface, which the
 * spec forbids (§61). The shapes carry the idea (an invoice becomes structured
 * data becomes a saving) without asserting a single figure.
 */

interface Token {
  position: [number, number, number];
  scale: number;
  kind: "product" | "price" | "supplier" | "saving";
}

const COLORS: Record<Token["kind"], string> = {
  product: "#6b7280",
  price: "#9aa1ad",
  supplier: "#4b5563",
  // Only savings get the accent — the same rule the whole UI follows.
  saving: "#10b981",
};

/**
 * Fixed layout rather than random: a random scatter re-rolls on every render
 * and can drop tokens on top of the invoice or off-screen.
 */
/**
 * Positions are pushed out toward the edges of the frame, clear of the centre
 * where the headline and the call to action live.
 */
const TOKENS: readonly Token[] = [
  { position: [-3.4, 1.7, -0.5], scale: 0.18, kind: "product" },
  { position: [3.5, 1.5, -0.8], scale: 0.15, kind: "price" },
  { position: [-3.1, -1.1, 0.5], scale: 0.13, kind: "supplier" },
  { position: [3.7, -1.2, 0.2], scale: 0.22, kind: "saving" },
  { position: [-4.1, 0.35, -1.3], scale: 0.12, kind: "price" },
  { position: [2.9, 2.4, 0.6], scale: 0.11, kind: "product" },
  { position: [-2.6, 2.5, 0.15], scale: 0.14, kind: "saving" },
  { position: [4.2, 0.4, -1.1], scale: 0.1, kind: "supplier" },
  { position: [-3.6, -2.2, -0.4], scale: 0.16, kind: "price" },
  { position: [2.7, -2.4, 0.4], scale: 0.12, kind: "product" },
];

/** Mobile keeps only the largest few, cutting draw calls (spec §51). */
const REDUCED_TOKEN_COUNT = 4;

function TokenMesh({ token }: { token: Token }) {
  const color = COLORS[token.kind];

  // Savings read as solid; everything else is a translucent wireframe, so the
  // eye lands on the accent tokens first.
  if (token.kind === "saving") {
    return (
      <mesh position={token.position}>
        <icosahedronGeometry args={[token.scale, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          roughness={0.3}
        />
      </mesh>
    );
  }

  return (
    <mesh position={token.position}>
      <boxGeometry args={[token.scale, token.scale, token.scale]} />
      {/* Faint: these are atmosphere, and a busy field of wireframes would
          pull attention off the call to action. */}
      <meshStandardMaterial color={color} transparent opacity={0.28} wireframe />
    </mesh>
  );
}

export function FloatingData({ reduced }: { reduced: boolean }) {
  const tokens = useMemo(
    () =>
      reduced
        ? [...TOKENS].sort((a, b) => b.scale - a.scale).slice(0, REDUCED_TOKEN_COUNT)
        : TOKENS,
    [reduced],
  );

  return (
    <>
      {tokens.map((token, index) => (
        <Float
          key={index}
          speed={1.1 + (index % 3) * 0.25}
          rotationIntensity={reduced ? 0.15 : 0.4}
          floatIntensity={reduced ? 0.3 : 0.7}
        >
          <TokenMesh token={token} />
        </Float>
      ))}
    </>
  );
}
