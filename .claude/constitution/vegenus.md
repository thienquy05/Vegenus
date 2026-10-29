# Constitution — Vegenus overrides

> Project-local rules. Each replaces the global rule with the same id (harness-os `mergeRuleSets`).
> Decided 2026-10-29 (owner delegated the choice); reasons in `docs/vegenus_progress.md` §6.

## CONST-CODE-001 — No shared mutation
- severity: medium
- enforcement: review
- domain: coding-standards

Never mutate an argument, module-level state, or an object after it has been returned or handed to
other code; return a new copy instead. Allowed: building up a value the function itself created and
has not yet shared (an accumulator array, a response being assembled), and framework APIs that only
work by mutation (for example Next.js `cookies().set`, `NextResponse` headers). The rule targets
aliasing bugs, which a value nobody else can see cannot cause.

## CONST-CODE-003 — Every number is explained
- severity: low
- enforcement: review
- domain: coding-standards

A meaningful threshold, delay or limit is either a named constant or an inline literal used inside
one function with a comment next to it that names the decision behind it (a PRD question, an owner
decision with its date, or a design section). A value used in two or more functions, or one with no
such comment, must be a named constant. Changing an applied migration to rename a literal is not
allowed; a later migration that rewrites the function names it then.
