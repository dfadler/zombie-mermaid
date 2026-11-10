const probeBox = (id: string): string =>
  `requirement ${id} {\nid: ${id}\ntext: t${id}\nrisk: low\nverifymethod: test\n}`

/** Layouts the gallery lacks (#2966): shared targets, a parallel pair, a cycle. */
export const REQUIREMENT_PROBES: Record<string, string> = {
  'Probe: shared targets': `requirementDiagram\n${['a', 'b', 'c', 'd'].map(probeBox).join('\n')}\na - contains -> b\na - contains -> c\nd - satisfies -> b\nd - satisfies -> c`,
  'Probe: parallel pair': `requirementDiagram\n${['a', 'e'].map(probeBox).join('\n')}\ne - satisfies -> a\ne - verifies -> a`,
  'Probe: cycle': `requirementDiagram\n${['a', 'b', 'c'].map(probeBox).join('\n')}\na - contains -> b\nb - contains -> c\nc - contains -> a`,
}
