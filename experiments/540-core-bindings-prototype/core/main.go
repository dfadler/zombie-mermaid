// Command core is a throwaway proof-of-concept "core" renderer for issue #540
// (https://github.com/dfadler/zombie-mermaid/issues/540): a core-plus-bindings
// split for multi-language support, modeled on the Temporal sdk-core pattern
// (shared native core + thin per-language bindings) rather than a WASM-outward
// build — see docs/research/443-multilang-ascii-renderer.md and
// docs/research/issue-495-go-rewrite-motivation.md for why WASM was ruled out
// for this codebase (bundle-size regression, and breaking the synchronous-
// render guarantee the README treats as load-bearing).
//
// Scope: this is NOT a port of zombie-mermaid's real flowchart ASCII renderer
// (src/parser.ts, src/ascii/converter.ts, src/ascii/grid.ts, src/ascii/draw.ts,
// and friends — a grid layout plus A* pathfinder plus edge bundling across
// dozens of files). It is a hand-written, from-scratch parser + layout +
// renderer for a deliberately tiny flowchart subset, built only far enough to
// reproduce the *exact* ASCII bytes the real TypeScript renderer produces for
// three fixed fixture inputs (see ../fixtures/). It exists to answer one
// question: "how much of the current TS would need to move vs. get wrapped."
//
// Supported input shape (nothing else):
//   - A single header line: "graph"/"flowchart" followed by a direction
//     (TD or LR — BT/RL are not handled).
//   - Edge lines of the form `A --> B` or chained `A --> B --> C`, where each
//     token is a bare identifier or `ID[Label]`. No node shapes beyond the
//     implicit rectangle, no subgraphs, no styling, no click directives.
//   - Every edge must run between adjacent ranks (rank = longest path from a
//     root). Skip-level edges are not routed (see renderTD's TODO).
//   - Direction family TD: handles a single fan-out (one source, many
//     targets) or a single fan-in (many sources, one target) per rank gap,
//     laid out with a 5-row Manhattan-style bundle matching the real
//     renderer's draw-bundles.ts behavior for these shapes specifically. A
//     gap containing more than one such group, or a genuinely general
//     many-to-many crossing, is not implemented.
//   - Direction family LR: handles only simple one-to-one chains (no fan-out
//     or fan-in) — sufficient for the one LR fixture, nothing more.
//
// Any input shape outside the above will still parse (best-effort) but the
// resulting layout/render is not guaranteed to look like anything reasonable,
// let alone match the real renderer. This is intentional: widening the
// subset was out of scope for a one-pass prototype. See ../README.md for the
// effort estimate of what a real port would take.
package main

import (
	"fmt"
	"io/ioutil" // this environment's Go toolchain (1.12.5) predates io.ReadAll (added in 1.16)
	"os"
	"sort"
	"strings"
)

const (
	gapX           = 5 // horizontal spacing between sibling boxes (matches AsciiRenderOptions.paddingX default)
	gapY           = 5 // vertical spacing between rank rows (matches AsciiRenderOptions.paddingY default)
	boxBorderPad   = 1 // interior padding inside a box (matches AsciiRenderOptions.boxBorderPadding default)
	boxHeightRows  = 5 // border, blank, label, blank, border
	labelRowOffset = 2 // row index of the label line within a box, 0-based
)

type node struct {
	id    string
	label string
}

type edge struct {
	from int
	to   int
}

type parsedGraph struct {
	direction string // "TD" or "LR" (only two families this prototype understands)
	nodes     []node
	edges     []edge
}

func main() {
	src, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		fmt.Fprintln(os.Stderr, "core: reading stdin:", err)
		os.Exit(1)
	}

	g, err := parse(string(src))
	if err != nil {
		fmt.Fprintln(os.Stderr, "core: parse error:", err)
		os.Exit(1)
	}

	ranks := computeRanks(g.nodes, g.edges)

	var out string
	switch g.direction {
	case "LR", "RL":
		out = renderLR(g.nodes, g.edges, ranks)
	default: // "TD", "BT", or unspecified — this prototype only really handles TD
		out = renderTD(g.nodes, g.edges, ranks)
	}

	fmt.Print(out) // no trailing newline — matches renderMermaidASCII's own output exactly
}

// parse reads the deliberately tiny flowchart subset described in the file
// header comment. It is NOT a general mermaid parser.
func parse(src string) (parsedGraph, error) {
	lines := strings.Split(src, "\n")

	var direction string
	var nodes []node
	nodeIndex := map[string]int{}
	var edges []edge

	headerSeen := false

	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}

		if !headerSeen {
			headerSeen = true
			upper := strings.ToUpper(line)
			switch {
			case strings.Contains(upper, "LR"):
				direction = "LR"
			case strings.Contains(upper, "RL"):
				direction = "RL"
			case strings.Contains(upper, "BT"):
				direction = "BT"
			default:
				direction = "TD"
			}
			continue
		}

		// Chained edge line: "A --> B --> C" (or just "A --> B").
		if !strings.Contains(line, "-->") {
			// Not an edge line this prototype understands; ignore rather
			// than fail, since this is a best-effort subset parser.
			continue
		}

		tokens := strings.Split(line, "-->")
		prevIdx := -1
		for _, tok := range tokens {
			tok = strings.TrimSpace(tok)
			if tok == "" {
				continue
			}
			id, label := parseNodeToken(tok)
			idx, ok := nodeIndex[id]
			if !ok {
				idx = len(nodes)
				nodeIndex[id] = idx
				nodes = append(nodes, node{id: id, label: label})
			}
			if prevIdx != -1 {
				edges = append(edges, edge{from: prevIdx, to: idx})
			}
			prevIdx = idx
		}
	}

	if !headerSeen {
		return parsedGraph{}, fmt.Errorf("empty input: expected a header line")
	}

	return parsedGraph{direction: direction, nodes: nodes, edges: edges}, nil
}

// parseNodeToken splits "ID[Label]" into ("ID", "Label"), or treats a bare
// "ID" as its own label (mermaid's own behavior when no bracket is given).
func parseNodeToken(tok string) (id string, label string) {
	open := strings.IndexByte(tok, '[')
	closeIdx := strings.LastIndexByte(tok, ']')
	if open >= 0 && closeIdx > open {
		return strings.TrimSpace(tok[:open]), strings.TrimSpace(tok[open+1 : closeIdx])
	}
	return tok, tok
}

// computeRanks assigns each node a rank via Bellman-Ford-style relaxation:
// rank[v] = max(rank[v], rank[u]+1) for every edge u->v, repeated until
// stable (bounded by len(nodes) passes, which is always enough for a DAG of
// this size). This is a longest-path-from-roots rank assignment, the same
// shape the real grid layout uses to decide row/column groupings.
func computeRanks(nodes []node, edges []edge) []int {
	ranks := make([]int, len(nodes))
	for pass := 0; pass < len(nodes)+1; pass++ {
		changed := false
		for _, e := range edges {
			if ranks[e.to] < ranks[e.from]+1 {
				ranks[e.to] = ranks[e.from] + 1
				changed = true
			}
		}
		if !changed {
			break
		}
	}
	return ranks
}

// --- shared box drawing -----------------------------------------------------

// box holds the drawing geometry for one node once layout has run.
type box struct {
	leftX, topY int
	width       int
}

func (b box) centerX() int  { return b.leftX + b.width/2 }
func (b box) rightX() int   { return b.leftX + b.width - 1 }
func (b box) labelRow() int { return b.topY + labelRowOffset }

func boxWidth(label string) int {
	return len(label) + 2*boxBorderPad + 2 // +2 for the two border characters
}

// canvas is a simple mutable rune grid, row-major.
type canvas struct {
	rows [][]rune
}

func newCanvas(height, width int) *canvas {
	rows := make([][]rune, height)
	for i := range rows {
		row := make([]rune, width)
		for j := range row {
			row[j] = ' '
		}
		rows[i] = row
	}
	return &canvas{rows: rows}
}

func (c *canvas) set(y, x int, r rune) {
	if y < 0 || y >= len(c.rows) || x < 0 || x >= len(c.rows[y]) {
		return // out of bounds is a bug elsewhere, but this is a throwaway PoC
	}
	c.rows[y][x] = r
}

func (c *canvas) hline(y, x0, x1 int, r rune) {
	if x0 > x1 {
		x0, x1 = x1, x0
	}
	for x := x0; x <= x1; x++ {
		c.set(y, x, r)
	}
}

func (c *canvas) String() string {
	lines := make([]string, len(c.rows))
	for i, row := range c.rows {
		lines[i] = string(row)
	}
	return strings.Join(lines, "\n")
}

// drawBox renders a 5-row box (border, blank, label, blank, border) with the
// given top-left corner.
func drawBox(c *canvas, b box, label string) {
	interior := b.width - 2
	pad := interior - len(label)
	leftPad := pad / 2
	rightPad := pad - leftPad

	top := strings.Repeat("-", interior)
	blank := strings.Repeat(" ", interior)
	labelLine := strings.Repeat(" ", leftPad) + label + strings.Repeat(" ", rightPad)

	writeRow := func(y int, content string) {
		c.set(y, b.leftX, '|')
		for i, r := range content {
			c.set(y, b.leftX+1+i, r)
		}
		c.set(y, b.leftX+b.width-1, '|')
	}

	c.set(b.topY, b.leftX, '+')
	for i, r := range top {
		c.set(b.topY, b.leftX+1+i, r)
	}
	c.set(b.topY, b.leftX+b.width-1, '+')

	writeRow(b.topY+1, blank)
	writeRow(b.topY+2, labelLine)
	writeRow(b.topY+3, blank)

	c.set(b.topY+4, b.leftX, '+')
	for i, r := range top {
		c.set(b.topY+4, b.leftX+1+i, r)
	}
	c.set(b.topY+4, b.leftX+b.width-1, '+')
}

// --- TD (vertical) rendering -------------------------------------------------

// renderTD lays out nodes top-to-bottom by rank, each rank a row of boxes
// packed left-to-right from column 0 (no centering — see the file header
// comment; this matches the real renderer's observed behavior for the
// fixture inputs, not necessarily its behavior in general). Edges between
// adjacent ranks are drawn as a 5-row Manhattan bundle: a single fan-out
// (one source, several targets) or a single fan-in (several sources, one
// target) per rank gap.
func renderTD(nodes []node, edges []edge, ranks []int) string {
	numRanks := 0
	for _, r := range ranks {
		if r+1 > numRanks {
			numRanks = r + 1
		}
	}

	rankGroups := make([][]int, numRanks)
	for idx := range nodes {
		r := ranks[idx]
		rankGroups[r] = append(rankGroups[r], idx)
	}

	boxes := make([]box, len(nodes))
	rowWidth := make([]int, numRanks)
	for r, group := range rankGroups {
		x := 0
		for _, idx := range group {
			w := boxWidth(nodes[idx].label)
			boxes[idx] = box{leftX: x, topY: r * (boxHeightRows + gapY), width: w}
			x += w + gapX
		}
		if len(group) > 0 {
			rowWidth[r] = x - gapX
		}
	}

	canvasWidth := 0
	for _, w := range rowWidth {
		if w > canvasWidth {
			canvasWidth = w
		}
	}
	canvasHeight := numRanks*boxHeightRows + (numRanks-1)*gapY
	if numRanks == 0 {
		canvasHeight = 0
	}

	c := newCanvas(canvasHeight, canvasWidth)

	for idx, n := range nodes {
		drawBox(c, boxes[idx], n.label)
	}

	// Bucket adjacent-rank edges by gap index, then by source and by target.
	type gapEdges struct {
		bySource map[int][]int
		byTarget map[int][]int
	}
	gaps := map[int]*gapEdges{}
	for _, e := range edges {
		r := ranks[e.from]
		if ranks[e.to] != r+1 {
			fmt.Fprintf(os.Stderr, "core: renderTD: skipping non-adjacent-rank edge %s->%s (unsupported in this prototype)\n", nodes[e.from].id, nodes[e.to].id)
			continue
		}
		ge, ok := gaps[r]
		if !ok {
			ge = &gapEdges{bySource: map[int][]int{}, byTarget: map[int][]int{}}
			gaps[r] = ge
		}
		ge.bySource[e.from] = append(ge.bySource[e.from], e.to)
		ge.byTarget[e.to] = append(ge.byTarget[e.to], e.from)
	}

	// A source box's exit-side border (its bottom row for TD, right column
	// for LR) is only ever redrawn as a '+' junction when that box has
	// exactly one outgoing edge in total — observed by diffing this
	// prototype's output against the real renderer's: a true fan-out
	// source's border stays a plain, unbroken "+---+" (the fork happens
	// entirely in the gap below, not at the border), while a fan-in's
	// several sources (each individually single-exit) each get their own
	// border junction. Entry-side borders (top for TD, left for LR) are
	// never modified either way. Not derived from reading the real
	// renderer's source — reverse-engineered from its output on these
	// three fixtures, so treat it as "matches these fixtures", not "is
	// definitely the real rule" beyond them.
	outDegree := map[int]int{}
	for _, e := range edges {
		outDegree[e.from]++
	}

	for r := 0; r < numRanks-1; r++ {
		ge, ok := gaps[r]
		if !ok {
			continue
		}
		gapTop := r*(boxHeightRows+gapY) + boxHeightRows
		handled := map[int]bool{} // node indices already drawn as part of a fan-out/fan-in group

		// Fan-out: one source, several targets.
		for src, targets := range ge.bySource {
			if len(targets) < 2 {
				continue
			}
			sort.Ints(targets)
			sx := boxes[src].centerX()
			minX, maxX := boxes[targets[0]].centerX(), boxes[targets[0]].centerX()
			for _, t := range targets {
				tx := boxes[t].centerX()
				if tx < minX {
					minX = tx
				}
				if tx > maxX {
					maxX = tx
				}
			}
			c.set(gapTop+0, sx, '|')
			c.set(gapTop+1, sx, '|')
			c.hline(gapTop+2, minX, maxX, '-')
			c.set(gapTop+2, minX, '+')
			c.set(gapTop+2, maxX, '+')
			for _, t := range targets {
				tx := boxes[t].centerX()
				c.set(gapTop+3, tx, '|')
				c.set(gapTop+4, tx, 'v')
			}
			if outDegree[src] == 1 { // never true here (len(targets)>=2), kept for symmetry with the other two cases
				c.set(boxes[src].topY+boxHeightRows-1, sx, '+')
			}
			handled[src] = true
		}

		// Fan-in: several sources, one target.
		for tgt, sources := range ge.byTarget {
			if len(sources) < 2 {
				continue
			}
			sort.Ints(sources)
			tx := boxes[tgt].centerX()
			minX, maxX := boxes[sources[0]].centerX(), boxes[sources[0]].centerX()
			for _, s := range sources {
				sx := boxes[s].centerX()
				if sx < minX {
					minX = sx
				}
				if sx > maxX {
					maxX = sx
				}
				c.set(gapTop+0, sx, '|')
				c.set(gapTop+1, sx, '|')
				if outDegree[s] == 1 {
					c.set(boxes[s].topY+boxHeightRows-1, sx, '+')
				}
				handled[s] = true
			}
			c.hline(gapTop+2, minX, maxX, '-')
			c.set(gapTop+2, minX, '+')
			c.set(gapTop+2, maxX, '+')
			c.set(gapTop+3, tx, '|')
			c.set(gapTop+4, tx, 'v')
		}

		// Simple 1-to-1 edges not already covered by a fan-out/fan-in group above.
		for src, targets := range ge.bySource {
			if len(targets) != 1 || handled[src] {
				continue
			}
			tgt := targets[0]
			if len(ge.byTarget[tgt]) != 1 {
				continue // target's fan-in already handled it
			}
			sx, tx := boxes[src].centerX(), boxes[tgt].centerX()
			c.set(gapTop+0, sx, '|')
			c.set(gapTop+1, sx, '|')
			if sx == tx {
				c.set(gapTop+2, sx, '|')
			} else {
				c.hline(gapTop+2, sx, tx, '-')
				c.set(gapTop+2, sx, '+')
				c.set(gapTop+2, tx, '+')
			}
			c.set(gapTop+3, tx, '|')
			c.set(gapTop+4, tx, 'v')
			if outDegree[src] == 1 { // always true here by construction, kept explicit for consistency
				c.set(boxes[src].topY+boxHeightRows-1, sx, '+')
			}
		}
	}

	return c.String()
}

// --- LR (horizontal) rendering ----------------------------------------------

// renderLR lays out nodes left-to-right by rank; each rank is a column. Only
// simple one-to-one chains are handled (no fan-out/fan-in in this direction)
// — enough for this prototype's one LR fixture, nothing more.
func renderLR(nodes []node, edges []edge, ranks []int) string {
	numRanks := 0
	for _, r := range ranks {
		if r+1 > numRanks {
			numRanks = r + 1
		}
	}

	rankGroups := make([][]int, numRanks)
	for idx := range nodes {
		r := ranks[idx]
		rankGroups[r] = append(rankGroups[r], idx)
	}

	colWidth := make([]int, numRanks)
	for r, group := range rankGroups {
		for _, idx := range group {
			w := boxWidth(nodes[idx].label)
			if w > colWidth[r] {
				colWidth[r] = w
			}
		}
	}

	colLeftX := make([]int, numRanks)
	x := 0
	for r := 0; r < numRanks; r++ {
		colLeftX[r] = x
		x += colWidth[r] + gapX
	}
	canvasWidth := x - gapX
	if numRanks == 0 {
		canvasWidth = 0
	}

	boxes := make([]box, len(nodes))
	canvasHeight := 0
	for r, group := range rankGroups {
		y := 0
		for _, idx := range group {
			w := boxWidth(nodes[idx].label)
			boxes[idx] = box{leftX: colLeftX[r], topY: y, width: w}
			y += boxHeightRows + gapY
		}
		total := y - gapY
		if total > canvasHeight {
			canvasHeight = total
		}
	}

	c := newCanvas(canvasHeight, canvasWidth)
	for idx, n := range nodes {
		drawBox(c, boxes[idx], n.label)
	}

	for _, e := range edges {
		if ranks[e.to] != ranks[e.from]+1 {
			fmt.Fprintf(os.Stderr, "core: renderLR: skipping non-adjacent-rank edge %s->%s (unsupported in this prototype)\n", nodes[e.from].id, nodes[e.to].id)
			continue
		}
		sRow, tRow := boxes[e.from].labelRow(), boxes[e.to].labelRow()
		if sRow != tRow {
			fmt.Fprintf(os.Stderr, "core: renderLR: skipping edge %s->%s at different rows (fan-out/fan-in unsupported in LR)\n", nodes[e.from].id, nodes[e.to].id)
			continue
		}
		x0, x1 := boxes[e.from].rightX()+1, boxes[e.to].leftX-1
		c.hline(sRow, x0, x1, '-')
		c.set(sRow, x1, '>')
		c.set(sRow, boxes[e.from].rightX(), '+') // junction on source's right border
	}

	return c.String()
}
