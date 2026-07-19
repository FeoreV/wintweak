import type {
  AdvisorReport,
  AppProviderStatus,
  RecoverySessionSummary,
  SystemAudit,
  TweakDefinition,
  TweakRecommendation,
} from "../types/backend.generated";

export type HomeState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "nativeAuditUnavailable" }
  | { kind: "actionableTweak"; recommendation: TweakRecommendation; tweak: TweakDefinition }
  | { kind: "reviewRequired"; recommendation: TweakRecommendation; tweak: TweakDefinition }
  | { kind: "restartEvidence"; audit: SystemAudit }
  | { kind: "providerAttention"; providers: AppProviderStatus[]; audit: SystemAudit }
  | { kind: "neutral"; audit: SystemAudit }
  | { kind: "empty"; audit: SystemAudit };

export type HomeStateInput = {
  loading: boolean;
  error: boolean;
  nativeAuditAvailable: boolean;
  audit?: SystemAudit;
  advisor?: AdvisorReport;
  catalog: TweakDefinition[];
  providers: AppProviderStatus[];
  recoveries: RecoverySessionSummary[];
};

export function deriveHomeState(input: HomeStateInput): HomeState {
  if (input.loading) return { kind: "loading" };
  if (input.error) return { kind: "error" };
  if (!input.nativeAuditAvailable) return { kind: "nativeAuditUnavailable" };
  if (!input.audit) return { kind: "error" };
  if (input.audit.pending_restart) return { kind: "restartEvidence", audit: input.audit };

  const byId = new Map(input.catalog.map((tweak) => [tweak.id, tweak]));
  const actionable = input.advisor?.recommendations.find(
    (item) => item.disposition === "recommended" && byId.has(item.tweak_id),
  );
  if (actionable) {
    return {
      kind: "actionableTweak",
      recommendation: actionable,
      tweak: byId.get(actionable.tweak_id) as TweakDefinition,
    };
  }

  const review = input.advisor?.recommendations.find(
    (item) => ["review_required", "mixed"].includes(item.disposition) && byId.has(item.tweak_id),
  );
  if (review) {
    return {
      kind: "reviewRequired",
      recommendation: review,
      tweak: byId.get(review.tweak_id) as TweakDefinition,
    };
  }

  const unavailableProviders = input.providers.filter((provider) => !provider.available);
  if (unavailableProviders.length > 0) {
    return { kind: "providerAttention", providers: unavailableProviders, audit: input.audit };
  }

  const hasEvidence =
    input.audit.tweak_statuses.length > 0 ||
    input.audit.package_providers.length > 0 ||
    input.audit.appx_package_count > 0 ||
    input.recoveries.length > 0;
  return hasEvidence
    ? { kind: "neutral", audit: input.audit }
    : { kind: "empty", audit: input.audit };
}
