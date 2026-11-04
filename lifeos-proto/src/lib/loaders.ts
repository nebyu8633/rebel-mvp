/**
 * Shared loaders: KTX2 (Basis) transcoder + meshopt for GLB. The transcoder lives in public/basis
 * (copied from three/examples/jsm/libs/basis) so the static build works offline inside Capacitor.
 */
import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

let ktx2: KTX2Loader | null = null;
export function getKTX2(gl: THREE.WebGLRenderer) {
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
    ktx2.detectSupport(gl);
  }
  return ktx2;
}

/** drei's useGLTF uses three-stdlib's GLTFLoader; typed structurally so either loader fits. */
interface GLTFLoaderLike {
  setKTX2Loader(l: unknown): unknown;
  setMeshoptDecoder(d: unknown): unknown;
}
export const gltfExtensions = (gl: THREE.WebGLRenderer) => (loader: GLTFLoaderLike) => {
  loader.setKTX2Loader(getKTX2(gl));
  loader.setMeshoptDecoder(MeshoptDecoder);
};

export const base = import.meta.env.BASE_URL;
export const asset = (p: string) => `${base}assets/${p}`;

/** Which GPU-compressed formats the device supports (for the bench report). */
export function compressedSupport(gl: THREE.WebGLRenderer) {
  const ctx = gl.getContext();
  const has = (n: string) => !!ctx.getExtension(n);
  return {
    astc: has("WEBGL_compressed_texture_astc"),
    etc2: has("WEBGL_compressed_texture_etc"),
    bc7: has("EXT_texture_compression_bptc"),
    s3tc: has("WEBGL_compressed_texture_s3tc"),
    pvrtc: has("WEBGL_compressed_texture_pvrtc"),
  };
}
