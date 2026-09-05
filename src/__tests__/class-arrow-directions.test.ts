/**
 * Comprehensive tests for class diagram arrow directions.
 *
 * Ensures all relationship types have correctly oriented arrows:
 * - Inheritance/Realization: hollow triangles point toward parent/interface
 * - Association/Dependency: filled arrows point from source to target
 * - Composition/Aggregation: diamonds are omnidirectional
 */

import { describe, test, expect } from 'vitest'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('Class Diagram Arrow Directions', () => {
  // ============================================================================
  // INHERITANCE (<|--)
  // ============================================================================

  describe('Inheritance (<|--)', () => {
    test('parent above child - triangle points UP toward parent', () => {
      const diagram = `classDiagram
        Animal <|-- Dog`
      const result = renderMermaidASCII(diagram)

      // Should contain upward triangle
      expect(result).toContain('△')
      expect(result).not.toContain('▽')

      // Parent should be above child
      const lines = result.split('\n')
      const animalLine = lines.findIndex((l) => l.includes('Animal'))
      const dogLine = lines.findIndex((l) => l.includes('Dog'))
      expect(animalLine).toBeLessThan(dogLine)
    })

    test('multiple inheritance creates separate arrows', () => {
      const diagram = `classDiagram
        Animal <|-- Dog
        Animal <|-- Cat
        Dog <|-- Puppy`
      const result = renderMermaidASCII(diagram)

      // Animal should be at top, then Dog/Cat, then Puppy
      const lines = result.split('\n')
      const animalLine = lines.findIndex((l) => l.includes('Animal'))
      const dogLine = lines.findIndex((l) => l.includes('Dog'))
      const catLine = lines.findIndex((l) => l.includes('Cat'))
      const puppyLine = lines.findIndex((l) => l.includes('Puppy'))

      expect(animalLine).toBeLessThan(dogLine)
      expect(animalLine).toBeLessThan(catLine)
      expect(dogLine).toBeLessThan(puppyLine)
    })

    test('multi-level inheritance - all triangles point UP', () => {
      const diagram = `classDiagram
        Animal <|-- Mammal
        Mammal <|-- Dog`
      const result = renderMermaidASCII(diagram)

      // Verify ordering: Animal > Mammal > Dog (top to bottom)
      const lines = result.split('\n')
      const animalLine = lines.findIndex((l) => l.includes('Animal'))
      const mammalLine = lines.findIndex((l) => l.includes('Mammal'))
      const dogLine = lines.findIndex((l) => l.includes('Dog'))

      expect(animalLine).toBeLessThan(mammalLine)
      expect(mammalLine).toBeLessThan(dogLine)

      // All triangles should point up
      expect(result.match(/△/g)?.length).toBe(2)
    })

    test('multiple inheritance from same parent', () => {
      const diagram = `classDiagram
        Animal <|-- Dog
        Animal <|-- Cat`
      const result = renderMermaidASCII(diagram)

      // Animal should be above both children
      const lines = result.split('\n')
      const animalLine = lines.findIndex((l) => l.includes('Animal'))
      const dogLine = lines.findIndex((l) => l.includes('Dog'))
      const catLine = lines.findIndex((l) => l.includes('Cat'))

      expect(animalLine).toBeLessThan(dogLine)
      expect(animalLine).toBeLessThan(catLine)

      // Should have at least one triangle pointing up (may merge visually)
      expect(result).toContain('△')
    })

    test('ASCII mode uses ^ for upward triangle', () => {
      const diagram = `classDiagram
        Animal <|-- Dog`
      const result = renderMermaidASCII(diagram, { useAscii: true })

      expect(result).toContain('^')
      expect(result).not.toContain('v')
    })
  })

  // ============================================================================
  // ASSOCIATION (-->)
  // ============================================================================

  describe('Association (-->)', () => {
    test('source above target - arrow points DOWN', () => {
      const diagram = `classDiagram
        Person --> Address`
      const result = renderMermaidASCII(diagram)

      // Should contain downward arrow
      expect(result).toContain('▼')
      expect(result).not.toContain('▲')

      // Person should be above Address
      const lines = result.split('\n')
      const personLine = lines.findIndex((l) => l.includes('Person'))
      const addressLine = lines.findIndex((l) => l.includes('Address'))
      expect(personLine).toBeLessThan(addressLine)
    })

    test('multiple associations from same source', () => {
      const diagram = `classDiagram
        Person --> Address
        Person --> Phone`
      const result = renderMermaidASCII(diagram)

      // Person should be above both targets
      const lines = result.split('\n')
      const personLine = lines.findIndex((l) => l.includes('Person'))
      const addressLine = lines.findIndex((l) => l.includes('Address'))
      const phoneLine = lines.findIndex((l) => l.includes('Phone'))

      expect(personLine).toBeLessThan(addressLine)
      expect(personLine).toBeLessThan(phoneLine)
    })

    test('chain of associations', () => {
      const diagram = `classDiagram
        A --> B
        B --> C`
      const result = renderMermaidASCII(diagram)

      // A > B > C ordering
      const lines = result.split('\n')
      const aLine = lines.findIndex((l) => l.includes('│ A │'))
      const bLine = lines.findIndex((l) => l.includes('│ B │'))
      const cLine = lines.findIndex((l) => l.includes('│ C │'))

      expect(aLine).toBeLessThan(bLine)
      expect(bLine).toBeLessThan(cLine)

      // Both arrows point down
      expect(result.match(/▼/g)?.length).toBe(2)
    })

    test('ASCII mode uses v for downward arrow', () => {
      const diagram = `classDiagram
        Person --> Address`
      const result = renderMermaidASCII(diagram, { useAscii: true })

      expect(result).toContain('v')
      expect(result).not.toContain('^')
    })

    test('association routed around an obstruction still points down (non-hierarchical detour case)', () => {
      // Same detour/collision-avoidance routing as the realization test
      // below, but with a plain association so the target-below-source
      // detour branch's `isHierarchical` ternary is exercised on its
      // non-hierarchical ('down') side too, not just the hierarchical
      // ('up') side.
      const diagram = `classDiagram
        class Flyable {
          <<interface>>
          +fly() void
        }
        class Helper {
          +assist() void
        }
        class Bird {
          +fly() void
        }
        Bird --> Helper
        Helper --> Flyable
        Bird --> Flyable`
      const result = renderMermaidASCII(diagram)

      expect(result).toContain('▼')
      expect(result).not.toContain('▲')
    })
  })

  // ============================================================================
  // DEPENDENCY (..>)
  // ============================================================================

  describe('Dependency (..>)', () => {
    test('source above target - arrow points DOWN', () => {
      const diagram = `classDiagram
        Client ..> Server`
      const result = renderMermaidASCII(diagram)

      expect(result).toContain('▼')
      expect(result).not.toContain('▲')

      const lines = result.split('\n')
      const clientLine = lines.findIndex((l) => l.includes('Client'))
      const serverLine = lines.findIndex((l) => l.includes('Server'))
      expect(clientLine).toBeLessThan(serverLine)
    })

    test('multiple dependencies', () => {
      const diagram = `classDiagram
        Client ..> Server
        Client ..> Database`
      const result = renderMermaidASCII(diagram)

      const lines = result.split('\n')
      const clientLine = lines.findIndex((l) => l.includes('Client'))
      const serverLine = lines.findIndex((l) => l.includes('Server'))
      const dbLine = lines.findIndex((l) => l.includes('Database'))

      expect(clientLine).toBeLessThan(serverLine)
      expect(clientLine).toBeLessThan(dbLine)
    })

    test('ASCII mode uses v for downward arrow', () => {
      const diagram = `classDiagram
        Client ..> Server`
      const result = renderMermaidASCII(diagram, { useAscii: true })

      expect(result).toContain('v')
    })
  })

  // ============================================================================
  // REALIZATION (..|>)
  // ============================================================================

  describe('Realization (..|>)', () => {
    test('implementation above interface - triangle points down into interface', () => {
      // Circle ..|> Shape means "Circle implements Shape". Layout places
      // "from" above "to" for every relationship type (matching real
      // mermaid.js — see issue #446), so Circle (implementation/from) is
      // placed ABOVE Shape (interface/to), with the hollow triangle sitting
      // just above Shape, its TIP touching (pointing down into) the
      // interface box — a hollow triangle points toward whichever box it's
      // adjacent to, not away from it.
      const diagram = `classDiagram
        Circle ..|> Shape`
      const result = renderMermaidASCII(diagram)

      // Circle (implementation) should be above Shape (interface)
      const lines = result.split('\n')
      const shapeLine = lines.findIndex((l) => l.includes('Shape'))
      const circleLine = lines.findIndex((l) => l.includes('Circle'))
      expect(circleLine).toBeLessThan(shapeLine)
      expect(result).toContain('▽')
    })

    test('realization with <|.. syntax (marker at from end)', () => {
      // Shape <|.. Circle means "Circle implements Shape" (same as Circle ..|> Shape)
      const diagram = `classDiagram
        Shape <|.. Circle`
      const result = renderMermaidASCII(diagram)

      // Shape (interface) should be above Circle (implementation)
      const lines = result.split('\n')
      const shapeLine = lines.findIndex((l) => l.includes('Shape'))
      const circleLine = lines.findIndex((l) => l.includes('Circle'))
      expect(shapeLine).toBeLessThan(circleLine)
      expect(result).toContain('△')
    })

    test('multiple implementations', () => {
      // Circle and Square both implement Shape
      const diagram = `classDiagram
        Circle ..|> Shape
        Square ..|> Shape`
      const result = renderMermaidASCII(diagram)

      // Both implementations above the shared interface
      const lines = result.split('\n')
      const shapeLine = lines.findIndex((l) => l.includes('Shape'))
      const circleLine = lines.findIndex((l) => l.includes('Circle'))
      const squareLine = lines.findIndex((l) => l.includes('Square'))

      expect(circleLine).toBeLessThan(shapeLine)
      expect(squareLine).toBeLessThan(shapeLine)
      // At least one triangle (may merge visually if same connection point).
      // markerAt='to' here (Shape), so the triangle points down into it: ▽.
      expect(result).toContain('▽')
    })

    test('realization edge routed around an obstruction still points down into the interface', () => {
      // Bird realizes Flyable two levels down (Helper sits in between,
      // forced there by Bird-->Helper and Helper-->Flyable), so Bird's
      // realization edge can't run straight down — it must detour around
      // Helper's box via the collision-avoidance routing path. This is a
      // different code path from the direct/no-collision case covered by
      // the tests above, and had its own separate rotation bug that was
      // missed in the original fix (only caught in review): the detour
      // branch's marker-drawing code needed the same `isHierarchical`
      // rotation compensation as the direct-routing branches.
      const diagram = `classDiagram
        class Flyable {
          <<interface>>
          +fly() void
        }
        class Helper {
          +assist() void
        }
        class Bird {
          +fly() void
        }
        Bird --> Helper
        Helper --> Flyable
        Bird ..|> Flyable`
      const result = renderMermaidASCII(diagram)

      // The realization edge is declared last, so it draws last and its
      // marker wins where it lands on the same cell as Helper-->Flyable's
      // own (unrelated, association-style) arrowhead — a separate,
      // pre-existing limitation of this renderer's last-write-wins cell
      // model, not something this test is about.
      expect(result).toContain('▽')
    })
  })

  // ============================================================================
  // COMPOSITION & AGGREGATION (omnidirectional diamonds)
  // ============================================================================

  describe('Composition (*--) and Aggregation (o--)', () => {
    test('composition - diamond is omnidirectional', () => {
      const diagram = `classDiagram
        Car *-- Engine`
      const result = renderMermaidASCII(diagram)

      // Should contain filled diamond
      expect(result).toContain('◆')
    })

    test('aggregation - hollow diamond is omnidirectional', () => {
      const diagram = `classDiagram
        Team o-- Player`
      const result = renderMermaidASCII(diagram)

      // Should contain hollow diamond
      expect(result).toContain('◇')
    })
  })

  // ============================================================================
  // MIXED SCENARIOS
  // ============================================================================

  describe('Mixed Relationship Scenarios', () => {
    test('all 6 relationship types together', () => {
      const diagram = `classDiagram
        A <|-- B : inheritance
        C *-- D : composition
        E o-- F : aggregation
        G --> H : association
        I ..> J : dependency
        K ..|> L : realization`
      const result = renderMermaidASCII(diagram)

      // A above B (inheritance, marker at 'from'/A) — marker sits just below
      // A pointing up into it: △. K above L (realization, marker at
      // 'to'/L) — marker sits just above L pointing down into it: ▽. Both
      // point toward their parent/interface; the glyph differs because the
      // marker's position relative to its target differs.
      expect(result.match(/△/g)?.length).toBe(1)
      expect(result.match(/▽/g)?.length).toBe(1)

      // Downward arrows for association and dependency
      expect(result.match(/▼/g)?.length).toBe(2)

      // Diamonds for composition and aggregation
      expect(result).toContain('◆')
      expect(result).toContain('◇')
    })

    test('inheritance with association - different arrow directions', () => {
      const diagram = `classDiagram
        Animal <|-- Dog
        Dog --> Food`
      const result = renderMermaidASCII(diagram)

      // Should have both up triangle (inheritance) and down arrow (association)
      expect(result).toContain('△')
      expect(result).toContain('▼')
    })

    test('circular reference creates valid layout', () => {
      const diagram = `classDiagram
        A --> B
        B --> C
        C ..> A`
      const result = renderMermaidASCII(diagram)

      // Cycles may create mixed arrow directions (up and down) to avoid overlaps
      // Just verify arrows are present and classes are rendered
      const hasUpArrow = result.includes('▲')
      const hasDownArrow = result.includes('▼')
      expect(hasUpArrow || hasDownArrow).toBe(true)
      expect(result).toContain('│ A │')
      expect(result).toContain('│ B │')
      expect(result).toContain('│ C │')
    })

    test('circular reference with a realization edge points the hollow triangle correctly (same-level routing)', () => {
      // Same cyclic structure as the test above (which forces A and C onto
      // the same level, routing their connecting edge below both boxes and
      // back up — a third, separate marker-drawing branch from the two
      // "target below/above source" cases covered elsewhere in this file),
      // but with the cycle-closing edge as a realization instead of a
      // dependency, so this same-level branch's `isHierarchical` rotation
      // compensation is exercised on its hierarchical side too.
      const diagram = `classDiagram
        A --> B
        B --> C
        C ..|> A`
      const result = renderMermaidASCII(diagram)

      // The hollow triangle must point up, into A (the realized interface,
      // approached from below after routing under B) — not down, away from
      // it.
      expect(result).toContain('△')
      expect(result).not.toContain('▽')
    })
  })

  // ============================================================================
  // ASCII vs UNICODE CONSISTENCY
  // ============================================================================

  describe('ASCII and Unicode Mode Consistency', () => {
    test('same diagram produces consistent layouts in both modes', () => {
      const diagram = `classDiagram
        Animal <|-- Dog
        Person --> Address`

      const unicode = renderMermaidASCII(diagram)
      const ascii = renderMermaidASCII(diagram, { useAscii: true })

      // Both should have same node ordering
      const unicodeLines = unicode.split('\n')
      const asciiLines = ascii.split('\n')

      const uAnimal = unicodeLines.findIndex((l) => l.includes('Animal'))
      const uDog = unicodeLines.findIndex((l) => l.includes('Dog'))
      const aPerson = asciiLines.findIndex((l) => l.includes('Person'))
      const aAddress = asciiLines.findIndex((l) => l.includes('Address'))

      expect(uAnimal).toBeLessThan(uDog)
      expect(aPerson).toBeLessThan(aAddress)

      // Unicode has △ and ▼, ASCII has ^ and v
      expect(unicode).toContain('△')
      expect(unicode).toContain('▼')
      expect(ascii).toContain('^')
      expect(ascii).toContain('v')
    })
  })

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    test('single inheritance relationship', () => {
      const diagram = `classDiagram
        A <|-- B`
      const result = renderMermaidASCII(diagram)

      expect(result).toContain('△')
      const lines = result.split('\n')
      const aLine = lines.findIndex((l) => l.includes('│ A │'))
      const bLine = lines.findIndex((l) => l.includes('│ B │'))
      expect(aLine).toBeLessThan(bLine)
    })

    test('classes with members maintain arrow directions', () => {
      const diagram = `classDiagram
        class Animal {
          +String name
          +eat() void
        }
        class Dog {
          +bark() void
        }
        Animal <|-- Dog`
      const result = renderMermaidASCII(diagram)

      expect(result).toContain('△')
      const lines = result.split('\n')
      const animalLine = lines.findIndex((l) => l.includes('Animal'))
      const dogLine = lines.findIndex((l) => l.includes('Dog'))
      expect(animalLine).toBeLessThan(dogLine)
    })
  })
})
