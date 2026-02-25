export type Campaign = {
  id: string;
  name: string;
  sponsor: string;
  target_roles: string[];
  target_tools: string[];
  required_task: string;
  subsidy_per_call_cents: number;
  budget_total_cents: number;
  budget_remaining_cents: number;
  query_urls: string[];
  active: boolean;
  created_at: string;
};

export type AppView = "landing" | "signup" | "dashboard" | "create-campaign" | "login" | "caller";

export type Profile = {
  id: string;
  email: string;
  region: string;
  roles: string[];
  tools_used: string[];
  created_at: string;
};

export type CreatorSummary = {
  total_events: number;
  success_events: number;
  success_rate: number;
  per_skill: Array<{
    skill_name: string;
    total_events: number;
    success_events: number;
    avg_duration_ms: number | null;
    last_seen_at: string;
  }>;
};

export type SponsorDashboardData = {
  campaign: Campaign;
  tasks_completed: number;
  sponsored_calls: number;
  spend_cents: number;
  remaining_budget_cents: number;
};

export type ServiceTaskConfig = {
  service: string;
  tasks: string[];
  subsidy_per_call_cents: number;
};

export type CampaignForm = {
  name: string;
  sponsor: string;
  target_roles: string;
  target_tools: string;
  serviceConfigs: ServiceTaskConfig[];
  budget_cents: number;
  require_human_verification: boolean;
};

export type SponsoredApi = {
  id: string;
  name: string;
  sponsor: string;
  description: string | null;
  upstream_url: string;
  upstream_method: string;
  price_cents: number;
  budget_total_cents: number;
  budget_remaining_cents: number;
  active: boolean;
  created_at: string;
};

export type PaymentRequired = {
  service: string;
  amount_cents: number;
  accepted_header: string;
  payment_required: string;
  message: string;
  next_step: string;
};

export type ServiceRunResponse = {
  service: string;
  output: string;
  payment_mode: string;
  sponsored_by: string | null;
  tx_hash: string | null;
};

export type SponsoredApiRunResponse = {
  api_id: string;
  payment_mode: string;
  sponsored_by: string | null;
  tx_hash: string | null;
  upstream_status: number;
  upstream_body: string;
};

export type ServiceCategory = { name: string; services: string[] };

export type TaskCategory = {
  name: string;
  tasks: string[];
};

export type AppDeepLink = {
  view: AppView | null;
  campaignId: string | null;
};

export type ButtonShapeProps = {
  isHovered: boolean;
};

export type GetStartedButton3DProps = {
  onClick: () => void;
  className?: string;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
      selectedAddress?: string;
    };
  }
}

export { };
