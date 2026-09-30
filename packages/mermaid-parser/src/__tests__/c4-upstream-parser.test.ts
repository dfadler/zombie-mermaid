import { describe, it, expect } from 'vitest'
import { splitStatements } from '@zombie-mermaid/core'
import { parseC4Diagram } from '../index.ts'

// Fixtures ported from lukilabs/beautiful-mermaid#71 (c4-parser.test.ts) by
// Victor Palma (devx), (MIT-licensed), adapted to this
// fork's `parseC4Diagram` model (lowercase `variant`/`kind`, `shape`,
// `children`/`elementAliases`). Assertions this design cannot satisfy are kept
// as `it.skip` with the reason, so the gap stays visible.

const parse = (src: string) => parseC4Diagram(splitStatements(src))

describe('upstream #71: diagram types', () => {
  it.each([
    ['C4Context', 'context'],
    ['C4Container', 'container'],
    ['C4Component', 'component'],
    ['C4Dynamic', 'dynamic'],
  ] as const)('parses %s as variant %s', (header, variant) => {
    const d = parse(`${header}\n  Person(user, "User", "A user")`)
    expect(d.variant).toBe(variant)
  })

  it('parses C4Deployment with an empty Deployment_Node block', () => {
    const d = parse(`C4Deployment
  Deployment_Node(aws, "AWS", "Cloud") {
  }`)
    expect(d.variant).toBe('deployment')
    expect(d.boundaries[0]).toMatchObject({ alias: 'aws', type: 'Cloud' })
  })

  // Upstream defaults an unknown header to C4Context; here it is an error.
  it('rejects an unknown header instead of defaulting to C4Context', () => {
    expect(() =>
      parse('UnknownDiagram\n  Person(user, "User", "A user")'),
    ).toThrow(/expected a header of C4Context/)
  })
})

describe('upstream #71: element declarations', () => {
  it('parses Person with alias, label, description', () => {
    const d = parse(`C4Context
  Person(user, "User", "A person who uses the system")`)
    expect(d.elements).toHaveLength(1)
    expect(d.elements[0]).toMatchObject({
      kind: 'person',
      alias: 'user',
      label: 'User',
      description: 'A person who uses the system',
      external: false,
    })
  })

  it('parses Person_Ext as external', () => {
    const d = parse('C4Context\n  Person_Ext(admin, "Admin", "External admin")')
    expect(d.elements[0]).toMatchObject({ kind: 'person', external: true })
  })

  it('parses System with alias and label only', () => {
    const d = parse('C4Context\n  System(sys, "My System")')
    expect(d.elements[0]).toMatchObject({
      kind: 'system',
      alias: 'sys',
      label: 'My System',
    })
    expect(d.elements[0]!.description).toBeUndefined()
  })

  it('parses System_Ext as external', () => {
    const d = parse(
      'C4Context\n  System_Ext(ext, "External System", "Third party")',
    )
    expect(d.elements[0]).toMatchObject({
      external: true,
      label: 'External System',
    })
  })

  it.each([
    [
      'Container(web, "Web App", "Java/Spring", "Serves web pages")',
      'container',
      'default',
      'Java/Spring',
    ],
    [
      'ContainerDb(db, "Database", "PostgreSQL", "Stores data")',
      'container',
      'db',
      'PostgreSQL',
    ],
    [
      'ContainerQueue(q, "Message Queue", "RabbitMQ", "Async")',
      'container',
      'queue',
      'RabbitMQ',
    ],
    [
      'Component(ctrl, "Controller", "Spring MVC", "Handles HTTP")',
      'component',
      'default',
      'Spring MVC',
    ],
    [
      'ComponentDb(repo, "Repository", "JPA", "Data access")',
      'component',
      'db',
      'JPA',
    ],
    [
      'ComponentQueue(h, "Event Handler", "Spring AMQP", "Events")',
      'component',
      'queue',
      'Spring AMQP',
    ],
  ] as const)('parses %s with technology', (line, kind, shape, technology) => {
    const d = parse(`C4Container\n  ${line}`)
    expect(d.elements[0]).toMatchObject({ kind, shape, technology })
  })

  it('parses _Ext variants for Container types', () => {
    const d = parse(
      'C4Container\n  Container_Ext(ext, "External API", "REST", "Third party")',
    )
    expect(d.elements[0]).toMatchObject({ kind: 'container', external: true })
  })

  it('parses multiple elements', () => {
    const d = parse(`C4Context
  Person(user, "User", "End user")
  System(sys, "System", "Main system")
  System_Ext(ext, "Email", "Sends emails")`)
    expect(d.elements).toHaveLength(3)
  })
})

describe('upstream #71: title', () => {
  it('parses a title directive', () => {
    const d = parse(`C4Context
  title System Context Diagram
  Person(user, "User", "End user")`)
    expect(d.title).toBe('System Context Diagram')
  })

  it('parses a quoted title', () => {
    const d = parse(`C4Context
  title "My C4 Diagram"
  Person(user, "User", "End user")`)
    expect(d.title).toBe('My C4 Diagram')
  })

  it('has no title when not specified', () => {
    const d = parse('C4Context\n  Person(user, "User", "End user")')
    expect(d.title).toBeUndefined()
  })
})

describe('upstream #71: boundaries', () => {
  it('parses System_Boundary with child elements', () => {
    const d = parse(`C4Context
  System_Boundary(sb, "System Boundary") {
    Container(web, "Web App", "Java", "Serves pages")
  }`)
    expect(d.boundaries).toHaveLength(1)
    expect(d.boundaries[0]).toMatchObject({
      alias: 'sb',
      label: 'System Boundary',
      elementAliases: ['web'],
    })
  })

  it.each(['Container_Boundary', 'Enterprise_Boundary', 'Boundary'])(
    'parses %s',
    (macro) => {
      const d = parse(`C4Context
  ${macro}(b, "Label") {
    System(sys, "Internal System", "Core system")
  }`)
      expect(d.boundaries[0]).toMatchObject({ alias: 'b', label: 'Label' })
    },
  )

  it('parses Deployment_Node as a boundary', () => {
    const d = parse(`C4Deployment
  Deployment_Node(aws, "AWS") {
    Container(web, "Web App", "Docker", "Runs in container")
  }`)
    expect(d.boundaries[0]).toMatchObject({
      alias: 'aws',
      elementAliases: ['web'],
    })
  })

  it('parses nested boundaries', () => {
    const d = parse(`C4Context
  Enterprise_Boundary(eb, "Enterprise") {
    System_Boundary(sb, "System") {
      Container(web, "Web App", "Java", "Serves pages")
    }
  }`)
    expect(d.boundaries).toHaveLength(1)
    expect(d.boundaries[0]!.children).toHaveLength(1)
    expect(d.boundaries[0]!.children[0]!.elementAliases).toEqual(['web'])
  })

  it('places an element in its innermost boundary only', () => {
    const d = parse(`C4Context
  Enterprise_Boundary(eb, "Enterprise") {
    System_Boundary(sb, "System") {
      Container(web, "Web", "Java", "App")
    }
  }`)
    expect(d.boundaries[0]!.elementAliases).toEqual([])
    expect(d.boundaries[0]!.children[0]!.alias).toBe('sb')
    expect(d.boundaries[0]!.children[0]!.elementAliases).toEqual(['web'])
  })

  // Known gap: the model keeps no boundary macro kind and no parent pointers;
  // nesting is expressed through `children` / `elementAliases` instead.
  it.skip('records the boundary macro kind (System_Boundary, Enterprise_Boundary, ...)', () => {
    const d = parse(`C4Context
  System_Boundary(sb, "S") {
    System(s, "S")
  }`)
    expect(d.boundaries[0]).toMatchObject({ kind: 'System_Boundary' })
  })

  it.skip('sets parentBoundary on nested elements and child boundaries', () => {
    const d = parse(`C4Context
  System_Boundary(sb, "System") {
    Container(web, "Web App", "Java", "Serves pages")
  }`)
    expect(d.elements.find((e) => e.alias === 'web')).toMatchObject({
      parentBoundary: 'sb',
    })
  })
})

describe('upstream #71: relationships', () => {
  const two = 'System(a, "A", "System A")\n  System(b, "B", "System B")'

  it('parses Rel with from, to, label', () => {
    const d = parse(`C4Context\n  ${two}\n  Rel(a, b, "Uses")`)
    expect(d.relationships).toHaveLength(1)
    expect(d.relationships[0]).toMatchObject({
      from: 'a',
      to: 'b',
      label: 'Uses',
    })
  })

  it('parses Rel with technology', () => {
    const d = parse(
      `C4Context\n  ${two}\n  Rel(a, b, "Makes API calls", "JSON/HTTPS")`,
    )
    expect(d.relationships[0]!.technology).toBe('JSON/HTTPS')
  })

  it.each(['Rel_D', 'Rel_U', 'Rel_L', 'Rel_R'])(
    'accepts the %s layout-hint macro as a plain relationship',
    (macro) => {
      const d = parse(`C4Context\n  ${two}\n  ${macro}(a, b, "Calls")`)
      expect(d.relationships).toHaveLength(1)
      expect(d.relationships[0]).toMatchObject({ from: 'a', to: 'b' })
    },
  )

  // Known gap: the direction hint is accepted and dropped; the flowchart
  // pipeline lays out by rank, so there is nothing to record it for.
  it.skip('records Rel_U/D/L/R direction hints', () => {
    const d = parse(`C4Context\n  ${two}\n  Rel_D(a, b, "Uses")`)
    expect(d.relationships[0]).toMatchObject({ direction: 'D' })
  })

  it('parses Rel_Back without reversing the declared endpoints', () => {
    const d = parse(`C4Context\n  ${two}\n  Rel_Back(a, b, "Returns")`)
    expect(d.relationships[0]).toMatchObject({ from: 'a', to: 'b' })
  })

  it('parses BiRel as one bidirectional relationship', () => {
    const d = parse(`C4Context\n  ${two}\n  BiRel(a, b, "Exchanges data")`)
    expect(d.relationships).toHaveLength(1)
    expect(d.relationships[0]).toMatchObject({
      from: 'a',
      to: 'b',
      label: 'Exchanges data',
      bidirectional: true,
    })
  })

  it('parses multiple relationships', () => {
    const d = parse(`C4Context
  Person(user, "User", "End user")
  System(web, "Web", "Frontend")
  System(api, "API", "Backend")
  Rel(user, web, "Visits")
  Rel(web, api, "Calls")
  Rel(api, web, "Returns data")`)
    expect(d.relationships).toHaveLength(3)
  })
})

describe('upstream #71: full diagrams', () => {
  it('parses a complete C4 context diagram', () => {
    const d = parse(`C4Context
  title System Context Diagram
  Person(customer, "Customer", "A customer of the bank")
  System(banking, "Internet Banking System", "Allows customers to manage accounts")
  System_Ext(email, "E-mail System", "Sends emails")
  System_Ext(mainframe, "Mainframe Banking System", "Stores account info")
  Rel(customer, banking, "Views account balances", "HTTPS")
  Rel(banking, email, "Sends emails using", "SMTP")
  Rel(banking, mainframe, "Gets account info from", "XML/HTTPS")`)
    expect(d.variant).toBe('context')
    expect(d.title).toBe('System Context Diagram')
    expect(d.elements).toHaveLength(4)
    expect(d.relationships).toHaveLength(3)
    expect(d.elements.find((e) => e.alias === 'customer')!.kind).toBe('person')
    expect(d.elements.find((e) => e.alias === 'email')!.external).toBe(true)
  })

  it('parses a C4 container diagram with boundaries', () => {
    const d = parse(`C4Container
  Person(user, "User", "End user")
  System_Boundary(sb, "Internet Banking System") {
    Container(web, "Web Application", "Java/Spring", "Delivers content")
    ContainerDb(db, "Database", "PostgreSQL", "Stores user data")
  }
  Rel(user, web, "Visits", "HTTPS")
  Rel(web, db, "Reads/writes", "JDBC")`)
    expect(d.elements).toHaveLength(3)
    expect(d.boundaries).toHaveLength(1)
    expect(d.boundaries[0]!.elementAliases).toHaveLength(2)
    expect(d.relationships).toHaveLength(2)
  })
})
