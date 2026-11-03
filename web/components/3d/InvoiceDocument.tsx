"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";

/**
 * The invoice at the centre of the scene: a sheet of paper with ruled lines
 * standing in for line items, and one line picked out in the accent colour —
 * the product's whole story in one object (spec §56).
 *
 * Geometry is primitive on purpose. No external model to download, nothing to
 * decode, and it stays sharp at any size.
 */
const PAPER_WIDTH = 2.1;
const PAPER_HEIGHT = 2.9;
const LINE_COUNT = 7;

/** The row rendered in accent — the one whose price moved. */
const HIGHLIGHTED_LINE = 3;

export function InvoiceDocument({ reduced }: { reduced: boolean }) {
  const group = useRef<Group>(null);
  const highlight = useRef<Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (group.current !== null) {
      // A slow drift so the sheet reads as a physical object rather than a
      // flat image. Amplitude stays small: this must never distract.
      group.current.rotation.y = Math.sin(time * 0.28) * 0.09;
      group.current.rotation.x = Math.cos(time * 0.22) * 0.045;
      group.current.position.y = Math.sin(time * 0.4) * 0.05;
    }

    // The highlighted row breathes, drawing the eye without animating anything
    // else. Skipped entirely on reduced devices.
    if (!reduced && highlight.current !== null) {
      const material = highlight.current.material;
      if (!Array.isArray(material) && "opacity" in material) {
        material.opacity = 0.55 + Math.sin(time * 1.6) * 0.25;
      }
    }
  });

  const lineSpacing = PAPER_HEIGHT / (LINE_COUNT + 2);

  return (
    <group ref={group}>
      {/* The sheet. */}
      <mesh castShadow={!reduced} receiveShadow={!reduced}>
        <boxGeometry args={[PAPER_WIDTH, PAPER_HEIGHT, 0.02]} />
        <meshStandardMaterial color="#f4f5f7" roughness={0.85} metalness={0.02} />
      </mesh>

      {/* Header block, standing in for the supplier details. */}
      <mesh position={[0, PAPER_HEIGHT / 2 - lineSpacing, 0.014]}>
        <planeGeometry args={[PAPER_WIDTH * 0.55, 0.13]} />
        <meshBasicMaterial color="#0a0b0d" />
      </mesh>

      {/* Line items. */}
      {Array.from({ length: LINE_COUNT }, (_, index) => {
        const y = PAPER_HEIGHT / 2 - lineSpacing * (index + 2.4);
        const isHighlighted = index === HIGHLIGHTED_LINE;
        // Ragged widths so it reads as text, not as a grid.
        const width = PAPER_WIDTH * (0.52 + ((index * 37) % 23) / 100);

        if (isHighlighted) {
          return (
            <mesh
              key={index}
              ref={highlight}
              position={[-(PAPER_WIDTH - width) / 2, y, 0.014]}
            >
              <planeGeometry args={[width, 0.075]} />
              <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
            </mesh>
          );
        }

        return (
          <mesh key={index} position={[-(PAPER_WIDTH - width) / 2, y, 0.014]}>
            <planeGeometry args={[width, 0.055]} />
            <meshBasicMaterial color="#9aa1ad" transparent opacity={0.4} />
          </mesh>
        );
      })}

      {/* Total line, weighted heavier than the rows above it. */}
      <mesh position={[PAPER_WIDTH * 0.26, -PAPER_HEIGHT / 2 + lineSpacing, 0.014]}>
        <planeGeometry args={[PAPER_WIDTH * 0.4, 0.1]} />
        <meshBasicMaterial color="#0a0b0d" />
      </mesh>
    </group>
  );
}
