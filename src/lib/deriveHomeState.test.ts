import { describe, expect, it } from "vitest";
import type { SystemAudit, TweakDefinition } from "../types/backend.generated";
import { deriveHomeState } from "./deriveHomeState";

const audit: SystemAudit = {
  environment: { windows: "windows11", build: 22631, architecture: "x86_64", is_admin: false },
  system_info: {
    computer_name: "TEST-PC",
    os_product_name: "Windows 11",
    os_display_version: "23H2",
    os_build: 22631,
    os_architecture: "x86_64",
    is_admin: false,
    cpu_name: "Processor",
    logical_cores: 8,
    total_memory_bytes: 16000000000,
    available_memory_bytes: 8000000000,
    gpu_adapters: ["GPU"],
    volumes: [],
    uptime_seconds: 1000,
  },
  pending_restart: false,
  pending_restart_reasons: [],
  tweak_statuses: [],
  recovery_session_count: 0,
  installed_apps_count: 0,
  appx_package_count: 0,
  driver_updates_count: 0,
  package_providers: [],
};

const base = {
  loading: false,
  error: false,
  nativeAuditAvailable: true,
  audit,
  catalog: [] as TweakDefinition[],
  providers: [],
  recoveries: [],
};

const tweak = { id: "documented_tweak" } as TweakDefinition;

describe("deriveHomeState", () => {
  it("prioritizes explicit loading, error, and native availability", () => {
    expect(deriveHomeState({ ...base, loading: true }).kind).toBe("loading");
    expect(deriveHomeState({ ...base, error: true }).kind).toBe("error");
    expect(deriveHomeState({ ...base, nativeAuditAvailable: false }).kind).toBe(
      "nativeAuditUnavailable",
    );
  });

  it("surfaces pending restart evidence without inventing a recommendation", () => {
    expect(
      deriveHomeState({
        ...base,
        audit: { ...audit, pending_restart: true, pending_restart_reasons: ["CBS"] },
      }).kind,
    ).toBe("restartEvidence");
  });

  it("returns empty when the native audit contains no evidence", () => {
    expect(deriveHomeState(base).kind).toBe("empty");
  });

  it("returns only recommendations that join to a real catalog definition", () => {
    expect(
      deriveHomeState({
        ...base,
        catalog: [tweak],
        advisor: {
          recommendations: [
            { tweak_id: tweak.id, disposition: "recommended", matched_goals: ["privacy"] },
          ],
        },
      }).kind,
    ).toBe("actionableTweak");
    expect(
      deriveHomeState({
        ...base,
        advisor: {
          recommendations: [
            { tweak_id: "missing", disposition: "recommended", matched_goals: ["privacy"] },
          ],
        },
      }).kind,
    ).toBe("empty");
  });

  it("surfaces unavailable package providers from provider evidence", () => {
    expect(
      deriveHomeState({
        ...base,
        providers: [{ manager: "winget", available: false }],
      }).kind,
    ).toBe("providerAttention");
  });
});
