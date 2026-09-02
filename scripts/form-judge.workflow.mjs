export const meta = {
  name: 'form-judge',
  description:
    "Judge whether each sample's ASCII terminal output faithfully reproduces the structure real mermaid.js renders for the same source",
  phases: [{ title: 'Judge' }],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    faithful: {
      type: 'boolean',
      description:
        'true if the ASCII rendering is a reasonable structural reproduction of what real mermaid.js shows — no missing/extra/misplaced elements, no truncated or corrupted text, no wrong connections. Minor stylistic differences inherent to monospace/ASCII art (no color, character-based lines/arrows, no rounded corners) are NOT findings.',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['minor', 'moderate', 'major'] },
          summary: {
            type: 'string',
            description:
              'One-sentence statement of the specific structural defect.',
          },
          evidence: {
            type: 'string',
            description:
              'The concrete signal proving it — quote the exact ASCII text/line and, where relevant, the SVG attribute/element that contradicts it.',
          },
        },
        required: ['severity', 'summary', 'evidence'],
      },
    },
  },
  required: ['faithful', 'findings'],
}

function buildPrompt(entry) {
  return `You are checking whether an ASCII/terminal-art rendering of a mermaid diagram is a faithful structural reproduction of how real, upstream mermaid.js actually renders the same diagram source.

Read this JSON file first: ${entry.path}

It contains exactly one sample with these fields:
- "source" — the mermaid diagram source text
- "trimmedSvg" — real mermaid.js's SVG output (ground truth — the actual upstream library, not a reimplementation; the same rendering engine behind the mermaid Live Editor and GitHub's own mermaid preview). Boilerplate (defs/markers/style block) has been stripped to save space — what remains are the actual per-diagram elements: their positions (x/y/width/height), classes, and data-* attributes (e.g. data-type="actor" vs data-type="participant" distinguishes a stick-figure actor from a box).
- "asciiText" — this repo's ASCII/terminal output for the same source. This is the literal text a real terminal would print — not a screenshot or an approximation of one.

Judge whether "asciiText" is a reasonable structural reproduction of what "trimmedSvg" shows. Look specifically for:
- An element rendered as the wrong kind (e.g. a mermaid \`actor\` — data-type="actor" — drawn as a plain box instead of something visually distinct from a \`participant\`)
- Two elements overlapping or colliding where they shouldn't (e.g. a note's text/border running into an unrelated lifeline, box, or another note)
- Truncated, clipped, or corrupted text (a label cut off mid-word, an attribute line silently missing)
- Wrong or missing connections/relationships (an edge/message that doesn't match the source, or is missing)
- An element positioned on the wrong side or attached to the wrong entity (e.g. "note left of X" ending up on the right, or over the wrong actors)

Do NOT flag: the absence of color, the use of characters (\`-\`/\`|\`/\`>\`) instead of smooth SVG lines/arrowheads, box corners being square instead of rounded, or any other difference that's simply inherent to ASCII art rather than a structural defect. If you're not confident something is a real structural discrepancy, don't report it — false positives are worse than a missed minor issue here.

Report every genuine finding, even minor ones, but keep each one concrete and evidence-based.`
}

phase('Judge')

const judgeable = args.filter((e) => e.judgeable)
const skipped = args.filter((e) => !e.judgeable)

log(
  `Judging ${judgeable.length} sample(s); skipping ${skipped.length} where either side failed to render.`,
)

const verdicts = await pipeline(judgeable, (entry) =>
  agent(buildPrompt(entry), {
    label: entry.id,
    phase: 'Judge',
    schema: VERDICT_SCHEMA,
  }).then((v) => ({
    id: entry.id,
    category: entry.category,
    title: entry.title,
    verdict: v,
  })),
)

const results = verdicts.filter(Boolean)
const withIssues = results.filter((r) => r.verdict && !r.verdict.faithful)

log(
  `${results.length} judged, ${withIssues.length} with findings, ${skipped.length} skipped (render failure on at least one side).`,
)

return {
  judged: results,
  skipped: skipped.map((e) => ({
    id: e.id,
    category: e.category,
    title: e.title,
    mermaidError: e.mermaidError,
    asciiError: e.asciiError,
  })),
}
