---
name: design-md
description: >-
  Create, validate, compare, and export DESIGN.md files — the standardized
  format for describing a visual identity / design system to coding agents.
  Use when generating a DESIGN.md, verifying an existing one, converting
  DESIGN.md tokens to Tailwind / CSS / W3C DTCG formats, or diffing two
  versions of a design system.
allowed-tools:
  - "Bash"
  - "Read"
  - "Write"
  - "Edit"
  - "WebFetch"
---

# DESIGN.md Skill

DESIGN.md is a self-contained, plain-text representation of a design system.
It combines **machine-readable design tokens** (YAML front matter) with
**human-readable design rationale** (markdown prose). It is the "source of
truth" for consistent styling across design sessions and between different AI
agents and tools.

The full format specification lives in
[`resources/spec.md`](resources/spec.md). Read it before working with any
DESIGN.md file. Syntactically valid reference examples live in
[`examples/`](examples/).

## CLI Reference

The official CLI is installed in this project as `@google/design.md`
v0.4.0. All commands are run from the project root:

| Command | Purpose |
| --- | --- |
| `npx @google/design.md lint DESIGN.md` | Validate a DESIGN.md file for structural correctness (exit 0 = clean, exit 1 = lint findings, exit 2 = unreadable file) |
| `npx @google/design.md diff DESIGN.md DESIGN-v2.md` | Compare two DESIGN.md files; reports token-level + prose regressions as structured JSON |
| `npx @google/design.md export --format json-tailwind DESIGN.md` | Export to Tailwind v3 `theme.extend` JSON |
| `npx @google/design.md export --format css-tailwind DESIGN.md` | Export to Tailwind v4 `@theme { ... }` CSS block |
| `npx @google/design.md export --format dtcg DESIGN.md` | Export to W3C Design Tokens format (`tokens.json`) |
| `npx @google/design.md export --format css-vars DESIGN.md` | Export to CSS custom properties |
| `npx @google/design.md spec` | Output the format specification |
| `npx @google/design.md spec --rules` | Output the spec + active linting rules table |

## Workflow

### 1. Creating a DESIGN.md

Structure every file in two layers:

1. **YAML front matter** — delimited by `---` lines at the top. Design tokens
   with the canonical schema:

   ```yaml
   ---
   version: alpha           # optional, current version
   name: <string>           # required — the design system / brand name
   description: <string>    # optional
   colors:
     primary: "#1A1C1E"     # any valid CSS color; hex recommended
     secondary: "#6C7278"
     tertiary: "#B8422E"
   typography:
     h1:
       fontFamily: Public Sans
       fontSize: 3rem
       fontWeight: 600
       lineHeight: 1.1
       letterSpacing: -0.02em
   rounded:
     sm: 4px
     md: 8px
     full: 9999px
   spacing:
     sm: 8px
     md: 16px
   components:
     button-primary:
       backgroundColor: "{colors.primary}"
       textColor: "{colors.tertiary}"
       rounded: "{rounded.md}"
       padding: 12px
   ---
   ```

2. **Markdown body** — organized into `##` sections in canonical order:
   `## Overview`, `## Colors`, `## Typography`, `## Rounded`, `## Spacing`,
   `## Components`, `## Do's and Don'ts`. Explain *why* values exist, not just
   what they are. Descriptions may name colors semantically (e.g. "Ink") and
   reference the token name.

Prose is guidance; **tokens are the normative values**.

### 2. Validating

After creating or editing a file, always run:

```bash
npx @google/design.md lint DESIGN.md
```

Fix any `error` findings. Review `warning` findings (e.g. missing `primary`
color, WCAG AA contrast below 4.5:1, orphaned tokens, missing typography) —
these degrade agent-generated output and should be resolved.

### 3. Exporting tokens

When the project needs the design values in a framework format, export from
the single source of truth rather than hand-copying:

```bash
npx @google/design.md export --format json-tailwind DESIGN.md > tailwind-theme.json
npx @google/design.md export --format css-vars DESIGN.md > tokens.css
```

### 4. Diffing design regressions

When a design system is updated, run a diff against the previous version and
check the `regression` boolean in the JSON output:

```bash
npx @google/design.md diff DESIGN.md DESIGN-v2.md
```

## Do's and Don'ts

- **Do** use hex notation (`#RRGGBB`) for colors — simplest and most widely
  supported.
- **Do** reference cross-token values with the `{path.to.token}` syntax.
- **Do** keep token names semantic (`primary`, `secondary`, `surface`,
  `on-surface`, `error`; `headline-lg`, `body-md`, `label-sm`).
- **Don't** include hex codes, font names, or other raw values more than once
  — reference tokens instead of duplicating values.
- **Don't** repeat a `## section` heading; duplicate headings are an error
  and the file is rejected.
- **Don't** invent structure that contradicts `resources/spec.md`; unknown
  top-level YAML keys that look like typos or dropped tokens trigger lint
  warnings.

## References

- [`resources/spec.md`](resources/spec.md) — canonical format specification
- [`examples/atmospheric-glass.md`](examples/atmospheric-glass.md) — full example
- [`examples/paws-and-paths.md`](examples/paws-and-paths.md) — full example
- [`examples/totality-festival.md`](examples/totality-festival.md) — full example