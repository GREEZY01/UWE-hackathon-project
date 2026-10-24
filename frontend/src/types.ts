export type Profile = "client" | "research" | "compliance" | "staff";
export type Role = "client" | "analyst" | "compliance_officer" | "staff";
export const profiles: Record<
  Profile,
  { name: string; short: string; role: Role; description: string }
> = {
  client: {
    name: "Client-facing assistant",
    short: "Client services",
    role: "client",
    description: "Advice boundaries, disclosures & customer support",
  },
  research: {
    name: "Research & analyst copilot",
    short: "Research",
    role: "analyst",
    description: "Grounded figures, sources & market integrity",
  },
  compliance: {
    name: "Compliance & operations",
    short: "Compliance",
    role: "compliance_officer",
    description: "Fair decisions, KYC & financial crime",
  },
  staff: {
    name: "Internal staff assistant",
    short: "Internal staff",
    role: "staff",
    description: "Confidentiality, access & document safety",
  },
};
export interface RuleResult {
  rule_id: string;
  name: string;
  stage: string;
  status: string;
  severity: string;
  explanation: string;
  regulation_references: (
    { reference: string; explanation: string } | string
  )[];
  evidence: string[];
  latency_ms?: number;
  method?: string;
  detected?: boolean;
}
export interface ChatResult {
  id: number;
  timestamp: string;
  profile: Profile;
  user_role: Role;
  guardrails: boolean;
  original_input: string;
  redacted_input: string;
  raw_model_output: string;
  final_output: string;
  rule_results: RuleResult[];
  final_action: string;
  latency_ms: Record<string, number>;
  policy_pack_version: string;
  model_name: string;
  model_called: boolean;
  hash?: string;
  previous_hash?: string;
}
export interface Scenario {
  id: string;
  title: string;
  profile: Profile;
  role: Role;
  prompt: string;
  risk: string;
  regulation: string;
}
export interface Comparison {
  scenario_id: string;
  off: ChatResult;
  on: ChatResult;
  scores: Record<"off" | "on", Record<string, boolean | null>>;
  removed_risks: string[];
  model: { provider: string; name: string };
  cached: boolean;
  note: string;
}
export interface Cache {
  generated_at: string;
  provider: string;
  scenarios: Scenario[];
  results: Record<string, Comparison>;
}
export interface PolicyRule {
  id: string;
  description: string;
  stage: string;
  enabled: boolean;
  severity: string;
  action: string;
  thresholds: { min_matches: number };
  regulations: { reference: string; explanation: string }[];
}
export interface Policy {
  profile: Profile;
  name: string;
  version: number;
  rules: PolicyRule[];
  disclosure: string;
  system_prompt: string;
  allowed_topics: string[];
}
export interface Rate {
  numerator: number;
  denominator: number;
  rate: number | null;
}
export interface Metrics {
  items: number;
  paired_items: number;
  errors: number;
  policy_violation: Record<"off" | "on", Rate>;
  content_violation: Record<"off" | "on", Rate>;
  unsupported_figure: Record<"off" | "on", Rate>;
  pii_leakage: Record<"off" | "on", Rate>;
  injection_success: Record<"off" | "on", Rate>;
  mnpi_catch: Record<"off" | "on", Rate>;
  false_positive: Rate;
  average_added_latency_ms: number | null;
  audit_complete: Record<"off" | "on", Rate>;
  catch_rate?: Rate;
  trace_detection?: Rate;
}
export interface Evaluation {
  id: string;
  status: string;
  finished_at: string;
  model: { provider: string; name: string };
  dataset: { items: number };
  metrics: {
    overall: Metrics;
    by_profile: Record<string, Metrics>;
    by_rule: Record<string, Metrics>;
  };
  methodology?: string[];
}
export interface Health {
  provider: string;
  live_available: boolean;
  stage: number;
}
