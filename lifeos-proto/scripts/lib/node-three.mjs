// Minimal browser shims so three's FBXLoader / GLTFExporter run in Node (asset build only).
import * as THREE from "three";
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.({ target: this }); this.onload?.({ target: this }); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((b) => { this.result = `data:${blob.type};base64,` + Buffer.from(b).toString("base64"); this.onloadend?.({ target: this }); this.onload?.({ target: this }); });
    }
  };
}
// FBX textures are not loaded here: textures are processed separately (TGA -> webp) and bound by material name.
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
THREE.ImageLoader.prototype.load = function () { return null; };
export { THREE };
