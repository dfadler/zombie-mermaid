/**
 * The icon registry and the feature/diagram-type data that indexes into it
 * — split out of the original `icons.tsx` (#934). Plain `.ts`, not `.tsx`:
 * nothing here renders JSX, only references the icon components other
 * modules in this directory define.
 */

import type { ReactNode } from 'react'

import type { ColorToken } from '../tokens.tsx'
import type { IconProps } from './base.tsx'
import {
  AccessibilityIcon,
  DualOutputIcon,
  MergeEdgesIcon,
  MonoModeIcon,
  ShikiIcon,
  SpeedIcon,
  SyncRenderIcon,
  ThemesIcon,
  ZeroDomIcon,
} from './feature-icons.tsx'
import {
  ClassIcon,
  ErIcon,
  FlowchartIcon,
  SequenceIcon,
  StateIcon,
  XyChartIcon,
} from './diagram-type-icons.tsx'
import {
  DownloadIcon,
  FitToViewIcon,
  ShareIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './editor-toolbar-icons.tsx'
import {
  ActivityIcon,
  ArrowRightIcon,
  CheckIcon,
  ChecklistIcon,
  ChevronRightIcon,
  ClockIcon,
  CommitIcon,
  CopyIcon,
  ExternalLinkIcon,
  FrameIcon,
  LockIcon,
  PullRequestIcon,
  TerminalIcon,
  WarningIcon,
} from './chrome-icons.tsx'

/**
 * Every stroke icon in the set, by name.
 *
 * A consumer that needs to pick an icon from data (a feature key, a pill
 * type) indexes this instead of switching over imports, and the test suite
 * iterates it so a new icon is held to the set's rules automatically rather
 * than needing its own case.
 */
export const ICONS = {
  dualOutput: DualOutputIcon,
  themes: ThemesIcon,
  shiki: ShikiIcon,
  monoMode: MonoModeIcon,
  zeroDom: ZeroDomIcon,
  syncRender: SyncRenderIcon,
  speed: SpeedIcon,
  accessibility: AccessibilityIcon,
  mergeEdges: MergeEdgesIcon,
  zoomIn: ZoomInIcon,
  zoomOut: ZoomOutIcon,
  fitToView: FitToViewIcon,
  share: ShareIcon,
  download: DownloadIcon,
  copy: CopyIcon,
  check: CheckIcon,
  arrowRight: ArrowRightIcon,
  chevronRight: ChevronRightIcon,
  clock: ClockIcon,
  warning: WarningIcon,
  pullRequest: PullRequestIcon,
  commit: CommitIcon,
  externalLink: ExternalLinkIcon,
  frame: FrameIcon,
  lock: LockIcon,
  terminal: TerminalIcon,
  checklist: ChecklistIcon,
  activity: ActivityIcon,
  flowchart: FlowchartIcon,
  state: StateIcon,
  sequence: SequenceIcon,
  class: ClassIcon,
  er: ErIcon,
  xyChart: XyChartIcon,
} as const satisfies Record<string, (props: IconProps) => ReactNode>

/** An icon's key in {@link ICONS}, e.g. `'monoMode'`. */
export type IconName = keyof typeof ICONS

/**
 * The six facts the home page's "Built for how diagrams get used now"
 * pillars enumerate, grouped in pairs by {@link PILLAR_GROUPS} (index-app.tsx)
 * into Output flexibility / Drop-in architecture / Proven at scale.
 *
 * Theming (15 built-in themes, Shiki compatibility) deliberately isn't
 * here: the home page's live Theme Showcase, directly above this section,
 * already proves it — restating it in a static card would just repeat what
 * the visitor already saw work. "Ultra-fast" and "CI-enforced
 * accessibility" take its place — both real README features
 * (`Ultra-fast — Renders 100+ diagrams in under 500ms`, `Accessible SVG
 * output, CI-enforced`) that were previously true of this fork but never
 * shown anywhere on the home page.
 */
export const FEATURE_ICONS = [
  { name: 'dualOutput', accent: '--blue', label: 'Dual output' },
  { name: 'monoMode', accent: '--amber', label: 'Mono mode' },
  { name: 'zeroDom', accent: '--pink', label: 'Zero DOM dependencies' },
  { name: 'syncRender', accent: '--green', label: 'Synchronous rendering' },
  { name: 'speed', accent: '--violet', label: 'Ultra-fast' },
  {
    name: 'accessibility',
    accent: '--cyan',
    label: 'CI-enforced accessibility',
  },
] as const satisfies readonly {
  name: IconName
  accent: ColorToken
  label: string
}[]

/**
 * The six diagram types the Diagrams hub and each per-type detail page
 * enumerate, each paired with its {@link ICONS} entry, accent, and the
 * `diagrams/<slug>.html` URL segment demo/diagram-pages-data.ts's
 * `DIAGRAM_TYPE_PROFILES` uses for the same six types (duplicated here
 * rather than imported, to keep this module's only file surface
 * self-contained per #597).
 *
 * Nothing on the site consumes this yet — wiring the gallery strip, the
 * Diagrams hub, and the per-type detail pages to it belongs to the
 * page-redesign issues building in parallel (#598, #601, and the eventual
 * Diagrams-hub issue), same as {@link FEATURE_ICONS} above.
 */
export const DIAGRAM_TYPE_ICONS = [
  {
    name: 'flowchart',
    slug: 'flowchart',
    accent: '--blue',
    label: 'Flowchart',
  },
  { name: 'state', slug: 'state', accent: '--violet', label: 'State diagram' },
  {
    name: 'sequence',
    slug: 'sequence',
    accent: '--cyan',
    label: 'Sequence diagram',
  },
  { name: 'class', slug: 'class', accent: '--pink', label: 'Class diagram' },
  { name: 'er', slug: 'er', accent: '--green', label: 'ER diagram' },
  {
    name: 'xyChart',
    slug: 'xy-chart',
    accent: '--amber',
    label: 'XY chart',
  },
] as const satisfies readonly {
  name: IconName
  slug: string
  accent: ColorToken
  label: string
}[]
