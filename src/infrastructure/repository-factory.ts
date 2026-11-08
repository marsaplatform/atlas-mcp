import type { AtlasRepository } from "../domain/repository";
import { DemoRepository } from "./demo-repository";
import { GorunRepository } from "./gorun-repository";
import { RestApiRepository } from "./rest-repository";
import { WordPressRepository } from "./wordpress-repository";

/**
 * ATLAS_DATA_MODE:
 *  - `demo`      bundled fixtures (default; no network)
 *  - `gorun`     records managed in the gorun CMS (ATLAS_GORUN_URL + ATLAS_GORUN_TOKEN) — used by the origin web service
 *  - `wordpress` the legacy Marsa WordPress `marsa/v1` API (ATLAS_WORDPRESS_URL)
 *  - `api`       the public Atlas REST API (ATLAS_API_URL, default https://atlas.marsaplatform.com) — used by the Worker
 */
export const createRepository = (env: Record<string, string | undefined> = process.env): AtlasRepository => {
  const mode = env.ATLAS_DATA_MODE ?? "demo";
  if (mode === "demo") return new DemoRepository();
  if (mode === "gorun") {
    const url = env.ATLAS_GORUN_URL;
    const token = env.ATLAS_GORUN_TOKEN;
    if (!url || !token) throw new Error("ATLAS_GORUN_URL and ATLAS_GORUN_TOKEN are required when ATLAS_DATA_MODE=gorun");
    return new GorunRepository(url, token);
  }
  if (mode === "wordpress") {
    const url = env.ATLAS_WORDPRESS_URL;
    if (!url) throw new Error("ATLAS_WORDPRESS_URL is required when ATLAS_DATA_MODE=wordpress");
    return new WordPressRepository(url);
  }
  if (mode === "api") return new RestApiRepository(env.ATLAS_API_URL ?? "https://atlas.marsaplatform.com");
  throw new Error(`Unsupported ATLAS_DATA_MODE: ${mode}`);
};
