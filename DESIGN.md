---
name: WinTweak AI Fluent Utility
description: A trustworthy, local-first Windows utility with restrained Fluent surfaces and explicit recovery states.
colors:
  page: "#EEF1F5"
  surface: "#F9FAFB"
  surface-raised: "#FFFFFF"
  text: "#171A1F"
  text-soft: "#5D6570"
  primary: "#176EB5"
  success: "#18754A"
  warning: "#916400"
  error: "#B42318"
  rail: "#17202A"
typography:
  body-md: { fontFamily: Segoe UI Variable, fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  label-md: { fontFamily: Segoe UI Variable, fontSize: 12px, fontWeight: 600, lineHeight: 1.3 }
  heading-md: { fontFamily: Cabinet Grotesk, fontSize: 24px, fontWeight: 700, lineHeight: 1.15 }
rounded: { sm: 6px, md: 9px, lg: 14px }
spacing: { xs: 5px, sm: 8px, md: 14px, lg: 22px, xl: 32px }
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 10px
  status-success:
    textColor: "{colors.success}"
  status-warning:
    textColor: "{colors.warning}"
  status-error:
    textColor: "{colors.error}"
---

# WinTweak AI

## Overview

A calm, precise Windows utility. Trust comes from exact previews, conservative blue interaction color, durable-recovery details, and honest progress states.

## Colors

Blue identifies actions and active progress. Green is reserved for completed outcomes, amber for cooperative cancellation, and red for failures. Dark mode mirrors these semantic roles through the existing CSS variables.

## Typography

Segoe UI Variable follows Windows conventions for controls and body copy. Cabinet Grotesk is limited to product and section headings; registry paths and session IDs use Cascadia Code or Consolas.

## Layout

Use compact 8–14px internal spacing for operational detail and 22–32px spacing between major sections. Long event and registry lists scroll within their dialog instead of expanding the viewport.

## Elevation & Depth

Prefer thin semantic borders and tonal surface layers. Reserve the existing soft shadow for raised application shells and modal surfaces.

## Shapes

Controls and status panels use restrained 6–9px radii. Larger 14px radii belong only to major containers.

## Components

Progress views pair a numeric committed-change count with a progress bar and ordered event list. Cancellation disables immediately and reads “cancelling…” until the backend confirms a safe boundary. Partial outcomes always surface the recovery session beside the undo action.

## Do's and Don'ts

- Do distinguish requested cancellation from confirmed cancellation.
- Do keep registry paths, committed counts, and recovery identifiers selectable and legible.
- Do use the same semantic status colors in light and dark themes.
- Don't imply that a committed registry write can be interrupted or silently rolled back.
- Don't hide partial recovery information behind another screen.
