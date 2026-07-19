# UI redesign audit

## Current information architecture and screens

The frontend is one React composition root with local view state rather than URL routing. `App.tsx` owns server state, mutations, selection state, theme, and persistence. `TweakerWorkspace.tsx` switches among four prototype views: Overview, Applications, Tweaks, and Activity. Plan review, apply progress, completion, and immediate undo share one modal. Language and theme are icon actions in the navigation rail rather than a Settings area.

- Overview loads the tweak catalog, live tweak statuses, recovery summaries, and—after a goal is selected—a deterministic advisor report. The current composition is a dashboard-like health panel plus metric cards, goal cards, and recommendations.
- Tweaks filters the same catalog/status/advisor data, selects tweak IDs, and opens exact plan review. Global catalog/status/recovery failure replaces the workspace with a retry state; loading uses fixed skeleton blocks.
- Review calls `plan_batch` only while the dialog is open and the selection is non-empty. Apply starts a cancellable task and polls its typed status; the dialog renders progress events, partial/failed outcomes, a recovery session ID, and immediate restore.
- Applications loads the embedded app catalog and package-provider status separately from the global workspace data. It has its own spinner, retry state, selection, provider choice, confirmation, install/update reports, and cancellation. Chocolatey bootstrap is a separate consented action.
- Activity lists recovery summaries and inspects one session, but its restore control is disabled even though `restore_session` is already available through the bridge.

## Current reusable frontend pieces

- Fluent UI v9 supplies accessible buttons, checkboxes, inputs, badges, dialogs, progress, messages, links, and focus management. Fluent is a component dependency, not a required visual language.
- `TweakerWorkspace` contains reusable rail items, risk/state labels, selection tray, catalog rows, recommendation rows, application operation reports, and recovery master/detail layout, although these are currently colocated in one large file.
- TanStack Query owns catalog, status, advisor, recovery, application, and provider request state. React local state owns navigation, filters, selections, task IDs, and dialog stage.
- `src/lib/bridge.ts` is the frontend IPC boundary. `src/types/backend.generated.ts` mirrors Rust DTOs. `src/lib/storage.ts` safely persists theme-adjacent preferences, goals, and provider choice.
- i18next loads matched EN/RU JSON resources. Catalog labels and descriptions intentionally fall back to typed backend catalog text; new product copy must exist in both locale files.
- `src/styles.css` is a single custom layer with duplicated prototype-era overrides. It already includes light/dark variables, focus treatment, forced-colors adjustments, and a global `prefers-reduced-motion` rule.

## Backend/frontend contracts that must remain stable

- Read: `list_tweaks`, `get_tweak_statuses`, `get_advisor_report`, `list_recovery_sessions`, `list_apps`, and `get_app_provider_statuses`.
- Tweak flow: `plan_batch` is the exact read-only preview; `start_apply_batch` returns a task ID; `get_apply_operation` reports queued/running/terminal phases and typed events; `cancel_apply_operation` cooperates at safe registry boundaries.
- Recovery: `restore_session` accepts only a session UUID, replays through the Rust recovery engine, and creates another reversible recovery session. Recovery summaries expose ID, timestamp, and entry count—not change detail.
- Store flow: install, update, and Chocolatey bootstrap are separate typed allow-list operations. Package operations are cancellable between launches, may partially succeed, and are not rollbackable. Bootstrap requires explicit acknowledgement and must not auto-resume an install.
- The frontend must continue invalidating statuses, advisor results, and recovery summaries after apply/restore. Rust command/event behavior and generated DTO shapes are out of scope for this redesign.

## New job-based IA and state map

| Product area | User job | Existing implementation/data |
| --- | --- | --- |
| Understand | Read the current Windows state and how WinTweak works | Catalog + statuses + recovery availability |
| Choose | Set goals, inspect documented tweaks, and build a selection | Advisor + catalog filters + local selection |
| Review | Verify exact current/target values before consent | `plan_batch`; modal workflow stage |
| Apply | Follow progress, cancel cooperatively, and see the outcome | apply task status/events; modal workflow stage |
| Recover | Find a session and restore it | recovery summaries + `restore_session` |
| Store | Choose software, review the provider command, then install/update | existing Applications flow |
| Settings | Change language and appearance | existing locale and theme state |

Understand, Choose, Recover, Store, and Settings are stable navigation destinations. Review and Apply are guarded workflow states reached from a non-empty tweak selection; Store uses its own parallel review/apply confirmation and task states.

## Safe changes, risks, and constraints

Safe: replace the dashboard composition, rename frontend views and copy, add a Settings destination, expose the already-wired restore mutation, create semantic CSS tokens, and restyle/recompose existing controls without changing their callbacks. The current view is not deep-linkable, so route semantics can be introduced as typed in-memory state without adding a router dependency.

Risks: recovery summaries lack per-change detail, so Recover cannot honestly show affected keys before a restore. App catalog names/descriptions/categories come from backend data and are not localized. Polling errors currently become generic mutation errors. The advisor is deterministic rather than model-based, so product language must describe goal matching rather than “AI.” The accepted Fluent ADR describes an earlier direction and should be superseded later if the design system is formalized beyond this foundation. `DESIGN.md` already contains uncommitted user changes and is not part of this work.
