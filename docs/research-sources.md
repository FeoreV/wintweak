# Tweak catalog research sources

The 2026-07-19 catalog/provider slice was independently implemented from Microsoft documentation and the existing WinTweak architecture. No third-party source code, prose, screenshots, branding, or assets were copied, so this work does not add a third-party runtime dependency or a `THIRD_PARTY_NOTICES.md` entry.

Product and behavior patterns were reviewed from:

- [Raphire/Win11Debloat](https://github.com/Raphire/Win11Debloat) — MIT; live detection, categories, profiles, and reversible workflows.
- [farag2/Sophia-Script-for-Windows](https://github.com/farag2/Sophia-Script-for-Windows) — MIT; independently reversible, documented operations.
- [ChrisTitusTech/winutil](https://github.com/ChrisTitusTech/winutil) — MIT; searchable catalog, inventory, and separate utility areas.
- [jonax1337/Reclaim](https://github.com/jonax1337/Reclaim) — MIT; Rust/Tauri live-state and reversible-by-design patterns.
- [Noktomezo/Winsentials](https://github.com/Noktomezo/Winsentials) — MIT; Rust/native module boundaries.
- [RajwanYair/RegiLattice](https://github.com/RajwanYair/RegiLattice) — MIT; audit, backup, and evidence concepts.
- [builtbybel/ThisIsWin11](https://github.com/builtbybel/ThisIsWin11) — MIT, archived; historical modular product organization only.
- [Sophia-Community/SophiApp](https://github.com/Sophia-Community/SophiApp), [memstechtips/Winhance](https://github.com/memstechtips/Winhance), and [builtbybel/FluentTweaker](https://github.com/builtbybel/FluentTweaker) — ideas-only because reuse rights were not verified for this slice.
- [lyrx2k/winchisel](https://github.com/lyrx2k/winchisel) — AGPL-3.0; ideas-only, no code or distinctive structure copied.
- [flick9000/winscript](https://github.com/flick9000/winscript) — GPL-3.0; ideas-only, no code copied and no arbitrary script generation added.

Each shipped operation links directly to its relevant Microsoft documentation in `src-tauri/data/tweaks/catalog.json`. Microsoft references, current Windows behavior, and disposable-VM results remain the normative basis for accepting a tweak.
