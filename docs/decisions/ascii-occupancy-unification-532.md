# ASCII collision-avoidance stays triplicated for now (issue #532 scoping)

Scoping/feasibility pass for [#532](https://github.com/dfadler/zombie-mermaid/issues/532)
(unify ASCII collision-avoidance into one occupancy module), per the issue's
own "no behavior change is proposed" framing. No renderer code changed.

**Full analysis (per-renderer feasibility, the shared-interface sketch, and
why no code change shipped) lives in the
[scoping comment on #532](https://github.com/dfadler/zombie-mermaid/issues/532)
rather than here** — this file is a pointer, not a duplicate copy.

## Conclusion

A literal migration of all three renderers onto the existing `Grid` isn't
safe enough to attempt as a mechanical refactor:

- `er-diagram.ts` — occupancy is derived from the rendered canvas itself, not
  a separate structure; backing it with `Grid` means a second, independent
  reservation store kept in parallel with every canvas write, trading a
  today-impossible bug class (canvas/grid drift) for a real one.
- `class-diagram.ts` — the box-occupancy check is more plausible to migrate,
  but its separate `territoryByRel` label allocator is a 1-D
  interval-scheduling problem with no natural `Grid` shape.
- `sequence.ts` — no occupancy/search mechanism at all; layout is
  collision-proof by construction. Nothing to retrofit; excluded from any
  future unification.

The narrower, safer win — extracting the shared *search algorithm*
(`findFreeLane`/`allocateTerritory`) rather than unifying storage, each
renderer keeping its own occupancy check as a callback — is scoped out as
follow-up issues:

- [#617](https://github.com/dfadler/zombie-mermaid/issues/617) — extract
  `findFreeLane` (ER + class-diagram row/column search)
- [#618](https://github.com/dfadler/zombie-mermaid/issues/618) — extract
  `allocateTerritory` (class-diagram's `territoryByRel`), blocked on
  [#531](https://github.com/dfadler/zombie-mermaid/issues/531)
- [#619](https://github.com/dfadler/zombie-mermaid/issues/619) — remove the
  dead `boxOccupancy` array in `class-diagram.ts`, spotted during this pass

[#531](https://github.com/dfadler/zombie-mermaid/issues/531) (a real, still-open
bug in the exact `territoryByRel` mechanism this issue discusses) should land
before any future extraction touches that code.
