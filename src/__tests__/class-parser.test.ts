/**
 * Tests for the class diagram parser.
 *
 * Covers: class blocks, attributes, methods, visibility, annotations,
 * relationships (all 6 types), cardinality, labels, inline attributes.
 */
import { describe, it, expect } from 'vitest'
import { parseClassDiagram, parseGenericTypes } from '../class/parser.ts'

/** Helper to parse — preprocesses text the same way index.ts does */
function parse(text: string) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))
  return parseClassDiagram(lines)
}

// ============================================================================
// Class definitions
// ============================================================================

describe('parseClassDiagram – class definitions', () => {
  it('parses a class block with attributes and methods', () => {
    const d = parse(`classDiagram
      class Animal {
        +String name
        +int age
        +eat() void
        +sleep()
      }`)
    expect(d.classes).toHaveLength(1)
    expect(d.classes[0]!.id).toBe('Animal')
    expect(d.classes[0]!.attributes).toHaveLength(2)
    expect(d.classes[0]!.methods).toHaveLength(2)
  })

  it('parses attribute visibility (+ - # ~)', () => {
    const d = parse(`classDiagram
      class MyClass {
        +String publicField
        -int privateField
        #double protectedField
        ~bool packageField
      }`)
    expect(d.classes[0]!.attributes[0]!.visibility).toBe('+')
    expect(d.classes[0]!.attributes[1]!.visibility).toBe('-')
    expect(d.classes[0]!.attributes[2]!.visibility).toBe('#')
    expect(d.classes[0]!.attributes[3]!.visibility).toBe('~')
  })

  it('parses method with return type', () => {
    const d = parse(`classDiagram
      class Calc {
        +add(a, b) int
      }`)
    expect(d.classes[0]!.methods[0]!.name).toBe('add')
    expect(d.classes[0]!.methods[0]!.type).toBe('int')
  })

  it('parses annotation <<interface>>', () => {
    const d = parse(`classDiagram
      class Flyable {
        <<interface>>
        +fly() void
      }`)
    expect(d.classes[0]!.annotation).toBe('interface')
    expect(d.classes[0]!.methods).toHaveLength(1)
  })

  it('parses inline annotation syntax', () => {
    const d = parse(`classDiagram
      class Shape { <<abstract>> }`)
    expect(d.classes[0]!.annotation).toBe('abstract')
  })

  it('parses standalone class declaration', () => {
    const d = parse(`classDiagram
      class EmptyClass`)
    expect(d.classes).toHaveLength(1)
    expect(d.classes[0]!.id).toBe('EmptyClass')
  })

  it('auto-creates classes from relationships', () => {
    const d = parse(`classDiagram
      Animal <|-- Dog`)
    expect(d.classes).toHaveLength(2)
    expect(d.classes.find((c) => c.id === 'Animal')).toBeDefined()
    expect(d.classes.find((c) => c.id === 'Dog')).toBeDefined()
  })
})

// ============================================================================
// Inline attributes
// ============================================================================

describe('parseClassDiagram – inline attributes', () => {
  it('parses inline attribute: ClassName : +Type name', () => {
    const d = parse(`classDiagram
      class Animal
      Animal : +String name
      Animal : +int age`)
    const cls = d.classes.find((c) => c.id === 'Animal')!
    expect(cls.attributes).toHaveLength(2)
    expect(cls.attributes[0]!.name).toBe('name')
  })
})

// ============================================================================
// Relationships
// ============================================================================

describe('parseClassDiagram – relationships', () => {
  it('parses inheritance: <|-- (marker at from)', () => {
    const d = parse(`classDiagram
      Animal <|-- Dog`)
    expect(d.relationships).toHaveLength(1)
    expect(d.relationships[0]!.type).toBe('inheritance')
    expect(d.relationships[0]!.from).toBe('Animal')
    expect(d.relationships[0]!.to).toBe('Dog')
    expect(d.relationships[0]!.markerAt).toBe('from')
  })

  it('parses composition: *-- (marker at from)', () => {
    const d = parse(`classDiagram
      Car *-- Engine`)
    expect(d.relationships[0]!.type).toBe('composition')
    expect(d.relationships[0]!.markerAt).toBe('from')
  })

  it('parses aggregation: o-- (marker at from)', () => {
    const d = parse(`classDiagram
      University o-- Department`)
    expect(d.relationships[0]!.type).toBe('aggregation')
    expect(d.relationships[0]!.markerAt).toBe('from')
  })

  it('parses association: --> (marker at to)', () => {
    const d = parse(`classDiagram
      Customer --> Order`)
    expect(d.relationships[0]!.type).toBe('association')
    expect(d.relationships[0]!.markerAt).toBe('to')
  })

  it('parses dependency: ..> (marker at to)', () => {
    const d = parse(`classDiagram
      Service ..> Repository`)
    expect(d.relationships[0]!.type).toBe('dependency')
    expect(d.relationships[0]!.markerAt).toBe('to')
  })

  it('parses realization: ..|> (marker at to)', () => {
    const d = parse(`classDiagram
      Bird ..|> Flyable`)
    expect(d.relationships[0]!.type).toBe('realization')
    expect(d.relationships[0]!.markerAt).toBe('to')
  })

  // --- Reversed arrow variants ---

  it('parses reversed realization: <|.. (marker at from)', () => {
    const d = parse(`classDiagram
      Flyable <|.. Bird`)
    expect(d.relationships[0]!.type).toBe('realization')
    expect(d.relationships[0]!.from).toBe('Flyable')
    expect(d.relationships[0]!.to).toBe('Bird')
    expect(d.relationships[0]!.markerAt).toBe('from')
  })

  it('parses reversed composition: --* (marker at to)', () => {
    const d = parse(`classDiagram
      Engine --* Car`)
    expect(d.relationships[0]!.type).toBe('composition')
    expect(d.relationships[0]!.from).toBe('Engine')
    expect(d.relationships[0]!.to).toBe('Car')
    expect(d.relationships[0]!.markerAt).toBe('to')
  })

  it('parses reversed aggregation: --o (marker at to)', () => {
    const d = parse(`classDiagram
      Department --o University`)
    expect(d.relationships[0]!.type).toBe('aggregation')
    expect(d.relationships[0]!.from).toBe('Department')
    expect(d.relationships[0]!.to).toBe('University')
    expect(d.relationships[0]!.markerAt).toBe('to')
  })

  it('parses relationship with label', () => {
    const d = parse(`classDiagram
      Customer --> Order : places`)
    expect(d.relationships[0]!.label).toBe('places')
  })

  it('parses relationship with cardinality', () => {
    const d = parse(`classDiagram
      Customer "1" --> "*" Order : places`)
    expect(d.relationships[0]!.fromCardinality).toBe('1')
    expect(d.relationships[0]!.toCardinality).toBe('*')
  })

  it('handles multiple relationships', () => {
    const d = parse(`classDiagram
      Animal <|-- Dog
      Animal <|-- Cat
      Dog *-- Leg`)
    expect(d.relationships).toHaveLength(3)
  })
})

// ============================================================================
// Full diagram
// ============================================================================

describe('parseClassDiagram – full diagram', () => {
  it('parses a complete class hierarchy', () => {
    const d = parse(`classDiagram
      class Animal {
        <<abstract>>
        +String name
        +eat() void
        +sleep() void
      }
      class Dog {
        +String breed
        +bark() void
      }
      class Cat {
        +bool isIndoor
        +meow() void
      }
      Animal <|-- Dog
      Animal <|-- Cat`)

    expect(d.classes).toHaveLength(3)
    expect(d.relationships).toHaveLength(2)
    const animal = d.classes.find((c) => c.id === 'Animal')!
    expect(animal.annotation).toBe('abstract')
    expect(animal.attributes).toHaveLength(1)
    expect(animal.methods).toHaveLength(2)
  })
})

// ============================================================================
// Generic types (`~T~` → `<T>`, matching mermaid's parseGenericTypes) — #418
// ============================================================================

describe('parseGenericTypes', () => {
  it('converts a simple generic', () => {
    expect(parseGenericTypes('List~Observer~')).toBe('List<Observer>')
  })

  it('converts a generic whose arguments contain a comma', () => {
    expect(parseGenericTypes('Map~K,V~')).toBe('Map<K,V>')
  })

  it('converts nested generics outermost-first', () => {
    expect(parseGenericTypes('List~List~T~~')).toBe('List<List<T>>')
  })

  it('converts several generics in one string independently', () => {
    expect(parseGenericTypes('Map~K,V~ m, List~T~ l')).toBe(
      'Map<K,V> m, List<T> l',
    )
  })

  it('leaves a lone tilde alone', () => {
    expect(parseGenericTypes('approx ~ value')).toBe('approx ~ value')
  })

  it('leaves text without tildes untouched', () => {
    expect(parseGenericTypes('String name')).toBe('String name')
  })
})

describe('parseClassDiagram – generic types in members', () => {
  it('converts an attribute type generic', () => {
    const d = parse(`classDiagram
      class EventEmitter {
        -List~Observer~ observers
      }`)
    const attr = d.classes[0]!.attributes[0]!
    expect(attr.visibility).toBe('-')
    expect(attr.type).toBe('List<Observer>')
    expect(attr.name).toBe('observers')
  })

  it('converts multi-argument and nested attribute generics', () => {
    const d = parse(`classDiagram
      class Registry {
        +Map~String,Handler~ handlers
        +List~List~int~~ matrix
      }`)
    const [handlers, matrix] = d.classes[0]!.attributes
    expect(handlers!.type).toBe('Map<String,Handler>')
    expect(handlers!.name).toBe('handlers')
    expect(matrix!.type).toBe('List<List<int>>')
    expect(matrix!.name).toBe('matrix')
  })

  it('converts generics in method params and return types', () => {
    const d = parse(`classDiagram
      class Repo {
        +findAll(Map~String,Object~ filter) List~Entity~
      }`)
    const m = d.classes[0]!.methods[0]!
    expect(m.name).toBe('findAll')
    expect(m.params).toBe('Map<String,Object> filter')
    expect(m.type).toBe('List<Entity>')
  })

  it('does not pair a package-visibility tilde with a generic tilde', () => {
    const d = parse(`classDiagram
      class Cache {
        ~List~Entry~ entries
      }`)
    const attr = d.classes[0]!.attributes[0]!
    expect(attr.visibility).toBe('~')
    expect(attr.type).toBe('List<Entry>')
    expect(attr.name).toBe('entries')
  })

  it('converts generics in inline member syntax', () => {
    const d = parse(`classDiagram
      Store : -List~Item~ items`)
    expect(d.classes[0]!.attributes[0]!.type).toBe('List<Item>')
  })
})
