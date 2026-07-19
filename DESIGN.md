---
name: WinTweak AI Design System
description: Material 3 Expressive, crafted to Apple HIG quality, with native Windows conformance.
colors:
  light:
    primary: "#005AC1"
    on-primary: "#FFFFFF"
    primary-container: "#D8E2FF"
    on-primary-container: "#001A41"
    secondary: "#565E71"
    on-secondary: "#FFFFFF"
    secondary-container: "#DAE2F9"
    on-secondary-container: "#131C2B"
    tertiary: "#705575"
    on-tertiary: "#FFFFFF"
    tertiary-container: "#FAD8FD"
    on-tertiary-container: "#28132E"
    surface: "#F9F9FF"
    on-surface: "#191C20"
    surface-variant: "#E1E2EC"
    on-surface-variant: "#44474F"
    surface-container-lowest: "#FFFFFF"
    surface-container-low: "#F3F3FA"
    surface-container: "#EDEDF4"
    surface-container-high: "#E7E8EE"
    surface-container-highest: "#E1E2E8"
    surface-tint: "#005AC1"
    outline: "#74777F"
    outline-variant: "#C4C6D0"
    success: "#286C3F"
    on-success: "#FFFFFF"
    success-container: "#ABF4BB"
    on-success-container: "#00210B"
    cancellation: "#7A5900"
    on-cancellation: "#FFFFFF"
    cancellation-container: "#FFDEA3"
    on-cancellation-container: "#261900"
    error: "#BA1A1A"
    on-error: "#FFFFFF"
    error-container: "#FFDAD6"
    on-error-container: "#410002"
  dark:
    primary: "#ADC6FF"
    on-primary: "#002E69"
    primary-container: "#004494"
    on-primary-container: "#D8E2FF"
    secondary: "#BEC6DC"
    on-secondary: "#283141"
    secondary-container: "#3E4759"
    on-secondary-container: "#DAE2F9"
    tertiary: "#DDBCE0"
    on-tertiary: "#402843"
    tertiary-container: "#573E5B"
    on-tertiary-container: "#FAD8FD"
    surface: "#111318"
    on-surface: "#E1E2E8"
    surface-variant: "#44474F"
    on-surface-variant: "#C4C6D0"
    surface-container-lowest: "#0C0E13"
    surface-container-low: "#191C20"
    surface-container: "#1D2024"
    surface-container-high: "#282A2F"
    surface-container-highest: "#33353A"
    surface-tint: "#ADC6FF"
    outline: "#8E9099"
    outline-variant: "#44474F"
    success: "#90D6A0"
    on-success: "#003919"
    success-container: "#0B5229"
    on-success-container: "#ABF4BB"
    cancellation: "#F2C15B"
    on-cancellation: "#402D00"
    cancellation-container: "#5C4300"
    on-cancellation-container: "#FFDEA3"
    error: "#FFB4AB"
    on-error: "#690005"
    error-container: "#93000A"
    on-error-container: "#FFDAD6"
  aliases:
    action: "{colors.current.primary}"
    on-action: "{colors.current.on-primary}"
    action-container: "{colors.current.primary-container}"
    on-action-container: "{colors.current.on-primary-container}"
    progress: "{colors.current.primary}"
    on-progress: "{colors.current.on-primary}"
    progress-container: "{colors.current.primary-container}"
    on-progress-container: "{colors.current.on-primary-container}"
    completed-success: "{colors.current.success}"
    on-completed-success: "{colors.current.on-success}"
    completed-success-container: "{colors.current.success-container}"
    on-completed-success-container: "{colors.current.on-success-container}"
    cooperative-cancellation: "{colors.current.cancellation}"
    on-cooperative-cancellation: "{colors.current.on-cancellation}"
    cooperative-cancellation-container: "{colors.current.cancellation-container}"
    on-cooperative-cancellation-container: "{colors.current.on-cancellation-container}"
    failure: "{colors.current.error}"
    on-failure: "{colors.current.on-error}"
    failure-container: "{colors.current.error-container}"
    on-failure-container: "{colors.current.on-error-container}"
typography:
  font-display: "Cabinet Grotesk, Segoe UI Variable Display, sans-serif"
  font-body: "Segoe UI Variable, sans-serif"
  font-mono: "Cascadia Code, Consolas, monospace"
  display-lg: { fontFamily: "{typography.font-display}", fontSize: 48px, fontWeight: 700, lineHeight: 1.08, letterSpacing: -0.5px }
  headline-lg: { fontFamily: "{typography.font-display}", fontSize: 32px, fontWeight: 700, lineHeight: 1.16, letterSpacing: -0.25px }
  headline-md: { fontFamily: "{typography.font-display}", fontSize: 28px, fontWeight: 650, lineHeight: 1.2, letterSpacing: 0 }
  title-lg: { fontFamily: "{typography.font-display}", fontSize: 22px, fontWeight: 650, lineHeight: 1.27, letterSpacing: 0 }
  title-md: { fontFamily: "{typography.font-body}", fontSize: 16px, fontWeight: 600, lineHeight: 1.5, letterSpacing: 0.1px }
  body-lg: { fontFamily: "{typography.font-body}", fontSize: 16px, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0.2px }
  body-md: { fontFamily: "{typography.font-body}", fontSize: 14px, fontWeight: 400, lineHeight: 1.43, letterSpacing: 0.2px }
  label-lg: { fontFamily: "{typography.font-body}", fontSize: 14px, fontWeight: 600, lineHeight: 1.43, letterSpacing: 0.1px }
  label-md: { fontFamily: "{typography.font-body}", fontSize: 12px, fontWeight: 600, lineHeight: 1.33, letterSpacing: 0.4px }
shape: { none: 0, extra-small: 4px, small: 8px, medium: 12px, large: 16px, extra-large: 28px, full: 999px }
spacing: { xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, 3xl: 48px }
motion:
  duration: { short: 120ms, medium: 240ms, long: 400ms }
  easing:
    standard: "cubic-bezier(0.2, 0, 0, 1)"
    emphasized-decelerate: "cubic-bezier(0.05, 0.7, 0.1, 1)"
    emphasized-accelerate: "cubic-bezier(0.3, 0, 0.8, 0.15)"
  spring-emphasis: { mass: 1, stiffness: 380, damping: 30 }
elevation:
  level-0: { surface: surface, tintOpacity: 0 }
  level-1: { surface: surface-container-low, tintOpacity: 0.05 }
  level-2: { surface: surface-container, tintOpacity: 0.08 }
  level-3: { surface: surface-container-high, tintOpacity: 0.11 }
  level-4: { surface: surface-container-highest, tintOpacity: 0.12 }
  level-5: { surface: surface-container-highest, tintOpacity: 0.14 }
---

# WinTweak AI

## Philosophy

WinTweak AI uses **Material 3 Expressive** as its visual and interaction language: expressive semantic color, dynamic tonal surfaces, a generous shape scale, spring-emphasized motion, large-radius containers, and tonal elevation. Execute it at **Apple HIG quality**: clarity, deference, and depth; exact spacing and typographic rhythm; restrained composition; and no decoration without a functional purpose.

**Fluent is not the aesthetic.** Use Fluent and Windows conventions only for native conformance: window chrome and management, system control affordances, keyboard and pointer behavior, accessibility, focus, menus, dialogs, and other OS-consistent behavior. Segoe UI Variable remains the native Windows body and control option. Do not introduce Fluent visual styling merely because the app runs on Windows, and do not switch UI frameworks to achieve this direction.

Trust is the product's quality bar. Every operation must remain legible, truthful, reversible where possible, and explicit where reversal is incomplete.

## Colors

Use the theme's semantic roles, never raw palette values in components. At runtime, `colors.current` resolves to the selected `light` or `dark` role set. `primary` is the action and active-progress role; `secondary` supports quieter controls and information; `tertiary` adds controlled expressive emphasis. Every colored surface must pair a role with its matching `on-*` role. Prefer `*-container`/`on-*-container` for persistent panels and chips, reserving saturated base roles for focused controls, indicators, and compact emphasis.

Success is reserved for backend-confirmed completion. Cooperative cancellation uses the cancellation role only while a stop is requested or safely confirmed; it is not an error. Error is reserved for failed or unsafe outcomes. Light and dark themes preserve these meanings through their own tonal palettes. `surface-tint` creates depth across surface-container levels; do not simulate hierarchy with arbitrary opacity or color.

## Typography

The hierarchy follows the M3 Expressive display, headline, title, body, and label scale. Cabinet Grotesk supplies the expressive display/headline voice; use it sparingly for product identity, page titles, and major section landmarks. Segoe UI Variable is the native, highly legible body/control face. Keep line lengths deliberate, align text to the spacing grid, and preserve the specified line heights and letter spacing rather than compressing dense utility views.

Registry paths, commands, values, session IDs, and recovery identifiers use Cascadia Code with Consolas fallback. They must remain selectable, untruncated when accuracy matters, and horizontally scrollable or safely wrapped when space is constrained.

## Layout

Use the 4px spacing foundation with 8–16px internal spacing for operational detail, 24–32px between related groups, and 48px only for major page separation. Favor clear grouping and breathing room over decorative density. Long event and registry lists scroll within their dialog instead of expanding the viewport. Compact layouts may reduce whitespace, never hit targets, legibility, or state clarity.

## Shapes

Use `medium` (12px) for standard controls, `large` (16px) for cards and status panels, and `extra-large` (28px) for dialogs, major containers, and expressive grouped surfaces. Use `full` only for pills, progress tracks, and circular controls. Smaller radii belong to nested technical elements, not the primary visual language. Avoid mixing radii without a containment reason.

## Elevation & Depth

Build hierarchy with M3 tonal elevation: surface-container steps plus the theme's `surface-tint` at the specified level opacity. Borders may clarify boundaries but must use semantic outline roles. Shadows are a restrained supplemental cue only for transient overlays or native window separation; never use large, dark shadows as the main elevation system.

## Motion

Motion explains state and hierarchy. Use the standard easing for routine transitions, emphasized deceleration for elements entering or settling, emphasized acceleration for exits, and the spring-emphasis token for a small number of high-value confirmations or container transformations. Keep amplitude restrained: motion should feel responsive and alive, never playful at the expense of operational confidence.

Under `prefers-reduced-motion: reduce`, remove springs, parallax, scale, and spatial travel. Apply state changes instantly or with a simple opacity/color crossfade of at most 100ms. Progress must remain understandable without animation.

## Components & Product Behavior

Previews must be exact: show the concrete registry paths, values, commands, scope, and expected effect before execution. Progress views pair a numeric committed-change count with a progress bar and ordered event list; never estimate completion in a way that can be mistaken for confirmed work.

Cancellation has two visibly distinct states. A request disables the action immediately and reads “Cancelling…” while work continues to the backend's next safe boundary. Only backend confirmation may label the operation cancelled. Never imply that an already committed registry write was interrupted or silently rolled back.

Partial outcomes must always show what completed, what did not, and the recovery session beside an always-visible undo/recovery action. Never hide partial recovery information behind another screen, collapse it by default, or replace it with a generic error.

## Do's and Don'ts

- Do distinguish requested cancellation from confirmed cancellation.
- Do keep registry paths, committed counts, and recovery identifiers selectable and legible.
- Do use matching semantic status and on-colors in both light and dark themes.
- Do use expressive color, shape, and motion to reinforce meaning and hierarchy.
- Don't treat Fluent as the product's visual identity; use it only for Windows-native conformance.
- Don't add decorative surfaces, motion, icons, or color without a functional role.
- Don't imply that a committed registry write can be interrupted or silently rolled back.
- Don't hide partial recovery or undo information behind another screen.
