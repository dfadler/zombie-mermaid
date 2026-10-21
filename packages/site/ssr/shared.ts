/** Client bundles (name -> JS text) produced by the client environments. */
export type Clients = Record<string, string>
/** Route table output: site-relative path -> file content. */
export type Routes = Map<string, string>

/** The live site's base URL — used for canonical links, sitemap.xml and the feed. */
export const SITE_URL = 'https://dfadler.github.io/zombie-mermaid'
