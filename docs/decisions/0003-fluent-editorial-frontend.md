# 0003: Fluent foundation with an editorial application shell

Date: 2026-07-18
Status: Accepted

## Context

The original handoff proposed shadcn/ui and Tailwind as a generic maintainable frontend stack. No frontend implementation existed, and the product direction changed toward a trustworthy Windows utility for non-technical users. A default shadcn dashboard would neither inherit Windows interaction behavior nor distinguish the product visually.

## Decision

Use Fluent UI React v9 for accessible controls, dialogs, focus management, and Windows-aligned tokens. Use Tailwind v4 only as a CSS build layer and for explicitly chosen utility classes; custom CSS implements the application composition.

The visual shell uses Cabinet Grotesk for large editorial headings and Segoe UI Variable for operational content. GSAP is limited to explainability and hierarchy transitions, honors reduced motion, and never animates registry operations or obscures their state.

## Consequences

The application feels native to Windows while retaining a recognizable product voice. The frontend carries both Fluent and GSAP dependencies, so bundle size must be measured and non-critical surfaces code-split as the application grows.

## Alternatives considered

Default shadcn/ui was rejected because it would require recreating Windows focus, dialog, and control behavior while producing a familiar web-dashboard appearance. Pure Fluent layouts were rejected because they would make the product indistinguishable from a stock settings screen. Hand-rolled controls were rejected on accessibility and maintenance grounds.
