/**
 * Cinematic post-processing for AETHERIA worlds, tiered for mobile:
 *   high    selective bloom (only very bright / emissive pixels), AgX tone mapping, vignette, SMAA
 *   medium  bloom at lower resolution, AgX, vignette (no SMAA)
 *   low     off — the renderer's own AgX tone mapping is used (zero extra passes)
 * While mounted, the composer owns tone mapping (it disables the renderer's), so ToneMapping is
 * always the last colour step here.
 */
import { EffectComposer, Bloom, ToneMapping, Vignette, SMAA } from "@react-three/postprocessing";
import { ToneMappingMode, KernelSize } from "postprocessing";
import type { Quality } from "../store";

export function PostFx({ quality }: { quality: Quality }) {
  if (quality === "low") return null;
  const high = quality === "high";
  const bloom = <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} intensity={high ? 0.75 : 0.6} radius={0.72} kernelSize={high ? KernelSize.LARGE : KernelSize.MEDIUM} resolutionScale={high ? 0.5 : 0.35} />;
  // the composer's children must all be effects, so the two tiers are separate trees
  return high ? (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloom}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.32} darkness={0.5} />
      <SMAA />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloom}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <Vignette offset={0.32} darkness={0.5} />
    </EffectComposer>
  );
}
