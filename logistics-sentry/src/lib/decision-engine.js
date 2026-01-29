export const riskRules = [
    {
        condition: "Stock drop > 50% in one update",
        action: "PAUSE",
        evaluate: (data) => {
            const drop = (data.expected_stock - data.current_stock) / data.expected_stock;
            return drop > 0.5;
        }
    },
    {
        condition: "Update conflicts with last 7-day sales trend",
        action: "PAUSE",
        evaluate: (data) => data.sales_velocity === "DECREASING" && data.intended_increase > 100,
    },
    {
        condition: "Multiple SKUs affected unexpectedly",
        action: "ESCALATE",
        evaluate: (data) => data.is_batch_update && data.unrelated_skus_detected,
    },
    {
        condition: "Update matches historical patterns",
        action: "PROCEED",
        evaluate: (data) => data.historical_match_score > 0.8,
    },
    {
        condition: "Data incomplete or ambiguous",
        action: "ESCALATE",
        evaluate: (data) => !data.current_stock || !data.recent_changes,
    }
];

export function evaluateRisk(agentOutput) {
    // Combine agent output with business logic rules
    if (agentOutput.confidence_score < 40) return "ESCALATE";
    if (agentOutput.recommended_action === "ESCALATE") return "ESCALATE";
    if (agentOutput.recommended_action === "PAUSE") return "PAUSE";

    return agentOutput.recommended_action || "PAUSE";
}
