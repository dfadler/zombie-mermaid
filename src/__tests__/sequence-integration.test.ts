/**
 * Integration tests for sequence diagrams — end-to-end parse → layout → render.
 */
import { describe, it, expect } from 'vitest'
import { renderMermaidSVG } from '../index.ts'

describe('renderMermaidSVG – sequence diagrams', () => {
  it('renders a basic sequence diagram to valid SVG', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      Alice->>Bob: Hello
      Bob-->>Alice: Hi there`)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('Alice')
    expect(svg).toContain('Bob')
    expect(svg).toContain('Hello')
  })

  it('renders participant declarations', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      participant A as Alice
      participant B as Bob
      A->>B: Message`)
    expect(svg).toContain('Alice')
    expect(svg).toContain('Bob')
    expect(svg).toContain('Message')
  })

  it('renders actor circle-person icons', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      actor U as User
      participant S as System
      U->>S: Click`)
    // Actors use the circle-person icon (three paths inside a scaled <g>)
    expect(svg).toContain('<g transform="translate(')
    expect(svg).toContain('scale(')
    expect(svg).toContain('User')
    expect(svg).toContain('System')
  })

  it('renders dashed return arrows', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      A->>B: Request
      B-->>A: Response`)
    // Dashed lines have stroke-dasharray
    expect(svg).toContain('stroke-dasharray')
    expect(svg).toContain('Request')
    expect(svg).toContain('Response')
  })

  it('renders loop blocks', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      A->>B: Start
      loop Every 5s
        A->>B: Ping
      end`)
    expect(svg).toContain('loop')
    expect(svg).toContain('Every 5s')
  })

  it('renders alt/else blocks', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      A->>B: Request
      alt Success
        B->>A: 200
      else Error
        B->>A: 500
      end`)
    expect(svg).toContain('alt')
    expect(svg).toContain('Success')
    // Else divider (dashed line)
    expect(svg).toContain('Error')
  })

  it('renders notes', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      A->>B: Hello
      Note right of B: Think about response
      B-->>A: Hi`)
    expect(svg).toContain('Think about response')
  })

  it('renders with dark colors', () => {
    const svg = renderMermaidSVG(
      `sequenceDiagram
      A->>B: Hello`,
      { bg: '#18181B', fg: '#FAFAFA' },
    )
    expect(svg).toContain('--bg:#18181B')
  })

  it('renders lifeline dashed lines', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      A->>B: Hello`)
    // Lifelines are dashed vertical lines
    const dashedLines = svg.match(/stroke-dasharray="6 4"/g)
    expect(dashedLines).toBeTruthy()
    expect(dashedLines!.length).toBeGreaterThanOrEqual(2) // at least 2 lifelines
  })

  it('renders a complex authentication flow', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      participant C as Client
      participant S as Server
      participant DB as Database
      C->>S: POST /login
      S->>DB: SELECT user
      alt User found
        DB-->>S: User record
        S-->>C: 200 OK + token
      else Not found
        DB-->>S: null
        S-->>C: 401 Unauthorized
      end`)
    expect(svg).toContain('<svg')
    expect(svg).toContain('Client')
    expect(svg).toContain('Server')
    expect(svg).toContain('Database')
    expect(svg).toContain('POST /login')
  })
})

describe('renderMermaidSVG – sequence diagrams – autonumber', () => {
  it('renders a sequence-number badge for each numbered message', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      autonumber
      Alice->>Bob: Hello
      Bob-->>Alice: Hi there`)
    expect(svg.match(/class="seq-number"/g)?.length).toBe(2)
    expect(svg).toContain('>1<')
    expect(svg).toContain('>2<')
  })

  it('does not render a sequence-number badge without autonumber', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      Alice->>Bob: Hello`)
    expect(svg).not.toContain('class="seq-number"')
  })
})

describe('renderMermaidSVG – sequence diagrams – bidirectional arrows', () => {
  it('renders a marker-start alongside marker-end for a bidirectional arrow', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      Alice<<->>Bob: Sync call`)
    expect(svg).toContain('data-bidirectional="true"')
    expect(svg).toMatch(/marker-start="url\(#seq-arrow\)"/)
  })

  it('a regular one-way arrow has no marker-start', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      Alice->>Bob: Hello`)
    expect(svg).toContain('data-bidirectional="false"')
    expect(svg).not.toContain('marker-start=')
  })
})

describe('renderMermaidSVG – sequence diagrams – multi-word inline actor names', () => {
  it('renders an undeclared actor name with a space and a hyphenated one', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      cron job->>customer-notifier: hi`)
    expect(svg).toContain('cron job')
    expect(svg).toContain('customer-notifier')
  })
})

describe('renderMermaidSVG – sequence diagrams – embedSource', () => {
  it('stamps data-src onto the root <svg> for a non-flowchart diagram type', () => {
    const source = `sequenceDiagram
      Alice->>Bob: Hello
      Bob-->>Alice: Hi there`
    const svg = renderMermaidSVG(source, { embedSource: true })
    const rootOpenTag = svg.slice(0, svg.indexOf('>') + 1)
    expect(rootOpenTag).toContain('xmlns="http://www.w3.org/2000/svg"')
    const escaped = rootOpenTag.match(/\sdata-src="([^"]*)"/)?.[1]
    expect(escaped).toBeDefined()
    const unescaped = (escaped ?? '')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#13;/g, '\r')
      .replace(/&#10;/g, '\n')
      .replace(/&#9;/g, '\t')
      .replace(/&amp;/g, '&')
    expect(unescaped).toBe(source)
  })

  it('omits data-src by default', () => {
    const svg = renderMermaidSVG(`sequenceDiagram
      Alice->>Bob: Hello`)
    expect(svg).not.toContain('data-src=')
  })
})
