import type { AtlasRepository } from "../domain/repository";
import { DemoRepository } from "./demo-repository";
import { RestApiRepository } from "./rest-repository";
import { WordPressRepository } from "./wordpress-repository";

/**
 * ATLAS_DATA_MODE:
 *  - `demo`      bundled fixtures (default; no network)
 *  - `wordpress` the Marsa WordPress `marsa/v1` API (ATLAS_WORDPRESS_URL) — used by the origin web service
 *  - `api`       the public Atlas REST API (ATLAS_API_URL, default https://atlas.marsaplatform.com) — used by the Worker
 */
export const createRepository = (env: Record<string, string | undefined> = process.env): AtlasRepository => {
  const mode = env.ATLAS_DATA_MODE ?? "demo";
  if (mode === "demo") return new DemoRepository();
  if (mode === "wordpress") {
    const url = env.ATLAS_WORDPRESS_URL;
    if (!url) throw new Error("ATLAS_WORDPRESS_URL is required when ATLAS_DATA_MODE=wordpress");
    return new WordPressRepository(url);
  }
  if (mode === "api") return new RestApiRepository(env.ATLAS_API_URL ?? "https://atlas.marsaplatform.com");
  throw new Error(`Unsupported ATLAS_DATA_MODE: ${mode}`);
};
