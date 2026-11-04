/**
 * Avatar Asset Loader — where the player's character model comes from.
 *
 * Phase 1 (now): the personal avatar is a LOCAL file produced by scripts/build-avatar.mjs into
 * public/avatar-private/ (gitignored, never committed or uploaded). If it is absent, the Rocketbox
 * placeholder is used and clearly labelled as such.
 * Later (needs separate approval): a private Supabase Storage source returning a short-lived signed
 * URL for the signed-in user only. The interface below is what that source will implement.
 */
import { asset, base } from "../lib/loaders";
import { params } from "../store";

export interface AvatarAsset {
  url: string;
  label: string;
  /** true while the generic stand-in is shown instead of the user's avatar */
  placeholder: boolean;
  source: AvatarSourceKind;
}
export type AvatarSourceKind = "local-private" | "placeholder" | "private-storage";

export interface AvatarAssetSource {
  readonly kind: AvatarSourceKind;
  /** Resolves to a loadable asset, or null when this source has no avatar for the user. */
  resolve(): Promise<AvatarAsset | null>;
}

export class LocalPrivateAvatarSource implements AvatarAssetSource {
  readonly kind = "local-private" as const;
  constructor(private readonly path = `${base}avatar-private/avatar.glb`) {}
  async resolve(): Promise<AvatarAsset | null> {
    try {
      const r = await fetch(this.path, { method: "HEAD", cache: "no-store" });
      const type = r.headers.get("content-type") ?? "";
      // dev servers answer unknown paths with index.html (200) — require a binary response
      if (!r.ok || type.includes("text/html")) return null;
      return { url: this.path, label: "האווטאר האישי שלך", placeholder: false, source: this.kind };
    } catch {
      return null;
    }
  }
}

export class PlaceholderAvatarSource implements AvatarAssetSource {
  readonly kind = "placeholder" as const;
  async resolve(): Promise<AvatarAsset> {
    const url = asset(params.get("tex") === "webp" ? "character/character.glb" : "character/character.ktx2.glb");
    return { url, label: "דמות זמנית (Rocketbox) — עד שהאווטאר האישי יוכן", placeholder: true, source: this.kind };
  }
}

/** Future: private Supabase Storage (signed URL per user). Not implemented — requires backend approval. */
export class PrivateStorageAvatarSource implements AvatarAssetSource {
  readonly kind = "private-storage" as const;
  async resolve(): Promise<AvatarAsset | null> {
    return null;
  }
}

/** First source that has an avatar wins; the placeholder always answers. `?avatar=placeholder` forces it. */
export async function resolveAvatar(sources: AvatarAssetSource[] = [new LocalPrivateAvatarSource(), new PlaceholderAvatarSource()]): Promise<AvatarAsset> {
  if (params.get("avatar") === "placeholder") return new PlaceholderAvatarSource().resolve();
  for (const s of sources) {
    const a = await s.resolve();
    if (a) return a;
  }
  return new PlaceholderAvatarSource().resolve();
}
