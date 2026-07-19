# 0004: Local explainable advisor

Date: 2026-07-18
Status: Accepted

## Context

The product name includes AI, but the first release targets ordinary users and performs privileged Windows mutations. Sending system state to an external model would add privacy, authentication, prompt-injection, availability, and nondeterminism risks before the core workflow is proven.

## Decision

The v1 advisor is local, deterministic, and explainable. It combines user-selected goals, current tweak status, catalog risk, and documented metadata. Low-risk matches may be recommended; moderate and high-risk matches always require review. Applied, mixed, and irrelevant states remain explicit. Advisor evaluation never mutates Windows and never accesses the network.

No tweak is automatically selected or applied. The existing plan command remains the source of truth for exact mutations, and the existing recovery protocol remains mandatory for apply and restore.

## Consequences

Recommendations are testable, auditable, and usable offline. The product cannot claim open-ended natural-language reasoning in v1. A future embedded model or cloud copilot requires a separate ADR, threat model, consent flow, and deterministic safety boundary.

## Alternatives considered

A cloud LLM copilot was rejected for the first release because it expands the privileged application's attack and privacy surface. Branding the product without any advisor was rejected because it would make the AI claim empty. Automatic safe presets were rejected because risk classification cannot replace explicit user consent.
