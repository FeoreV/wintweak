//! Explainable, local-only tweak recommendations.

use std::collections::{HashMap, HashSet};

use crate::types::{
    AdvisorReport, AdvisorRequest, RecommendationDisposition, TweakDefinition, TweakRecommendation,
    TweakRisk, TweakState, TweakStatus,
};

/// Produces deterministic recommendations without network access or mutation.
pub fn advise(
    request: &AdvisorRequest,
    catalog: &[TweakDefinition],
    statuses: &[TweakStatus],
) -> AdvisorReport {
    let requested: HashSet<_> = request.goals.iter().copied().collect();
    let states: HashMap<_, _> = statuses
        .iter()
        .map(|status| (status.id.as_str(), status.state))
        .collect();

    let recommendations = catalog
        .iter()
        .map(|tweak| {
            let matched_goals = tweak
                .goals
                .iter()
                .copied()
                .filter(|goal| requested.contains(goal))
                .collect::<Vec<_>>();
            let state = states
                .get(tweak.id.as_str())
                .copied()
                .unwrap_or(TweakState::NotApplied);
            let disposition = disposition(state, tweak.risk, matched_goals.is_empty());

            TweakRecommendation {
                tweak_id: tweak.id.clone(),
                disposition,
                matched_goals,
            }
        })
        .collect();

    AdvisorReport { recommendations }
}

fn disposition(
    state: TweakState,
    risk: TweakRisk,
    has_no_matching_goal: bool,
) -> RecommendationDisposition {
    match state {
        TweakState::Applied => RecommendationDisposition::AlreadyApplied,
        TweakState::Mixed => RecommendationDisposition::Mixed,
        TweakState::NotApplied if has_no_matching_goal => RecommendationDisposition::NotRelevant,
        TweakState::NotApplied if matches!(risk, TweakRisk::Low) => {
            RecommendationDisposition::Recommended
        }
        TweakState::NotApplied => RecommendationDisposition::ReviewRequired,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{RegistryAction, UserGoal};

    fn tweak(id: &str, risk: TweakRisk, goals: Vec<UserGoal>) -> TweakDefinition {
        TweakDefinition {
            id: id.to_owned(),
            label: id.to_owned(),
            description: id.to_owned(),
            category: "test".to_owned(),
            goals,
            risk,
            requires_restart: false,
            references: Vec::new(),
            actions: Vec::<RegistryAction>::new(),
        }
    }

    #[test]
    fn recommends_only_low_risk_goal_matches() {
        let catalog = vec![
            tweak("low", TweakRisk::Low, vec![UserGoal::Privacy]),
            tweak("moderate", TweakRisk::Moderate, vec![UserGoal::Privacy]),
            tweak("other", TweakRisk::Low, vec![UserGoal::Development]),
        ];
        let statuses = catalog
            .iter()
            .map(|item| TweakStatus {
                id: item.id.clone(),
                state: TweakState::NotApplied,
            })
            .collect::<Vec<_>>();

        let report = advise(
            &AdvisorRequest {
                goals: vec![UserGoal::Privacy],
            },
            &catalog,
            &statuses,
        );

        assert_eq!(
            report.recommendations[0].disposition,
            RecommendationDisposition::Recommended
        );
        assert_eq!(
            report.recommendations[1].disposition,
            RecommendationDisposition::ReviewRequired
        );
        assert_eq!(
            report.recommendations[2].disposition,
            RecommendationDisposition::NotRelevant
        );
    }

    #[test]
    fn current_state_overrides_goal_matching() {
        let catalog = vec![tweak("privacy", TweakRisk::Low, vec![UserGoal::Privacy])];
        let statuses = vec![TweakStatus {
            id: "privacy".to_owned(),
            state: TweakState::Applied,
        }];

        let report = advise(
            &AdvisorRequest {
                goals: vec![UserGoal::Privacy],
            },
            &catalog,
            &statuses,
        );

        assert_eq!(
            report.recommendations[0].disposition,
            RecommendationDisposition::AlreadyApplied
        );
    }
}
