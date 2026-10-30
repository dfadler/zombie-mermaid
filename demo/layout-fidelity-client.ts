/**
 * Browser entry for layout-fidelity.html (#1686): the page is static, so this
 * only hydrates the nav island, like the other pages' clients do after their
 * own app.
 */
import { hydrateNav } from './nav-client.tsx'

hydrateNav()
