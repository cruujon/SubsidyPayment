import type { CampaignForm, ServiceCategory, TaskCategory } from "./types";

export const defaultCampaignForm: CampaignForm = {
  name: "",
  sponsor: "",
  target_roles: "developer",
  target_tools: "scraping",
  serviceConfigs: [],
  budget_cents: 500,
  require_human_verification: false
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { name: "DeFi / Web3", services: ["Uniswap", "Aave", "OpenSea", "Lido Finance", "Compound", "Chainlink"] },
  { name: "AI Services", services: ["Claude (Anthropic)", "OpenAI API", "Hugging Face", "Replicate", "Midjourney API"] },
  { name: "API / Data", services: ["CoinGecko", "Alchemy", "The Graph", "Moralis", "Infura"] },
  { name: "Developer Tools", services: ["GitHub Copilot", "Vercel", "Supabase", "Neon (Postgres)", "Render", "Railway"] }
];

export const KPI_OPTIONS = [
  "CPA (Cost per Acquisition)",
  "CPI (Cost per Install)",
  "Cost per Signup",
  "Incremental Conversions",
  "Cost per Qualified Lead"
];

export const TASK_CATEGORIES: TaskCategory[] = [
  {
    name: "Contact Sharing",
    tasks: [
      "Share email address",
      "Share Telegram ID"
    ]
  },
  {
    name: "User Acquisition / Engagement",
    tasks: [
      "Sign up for the sponsor's service",
      "Complete specific actions on the sponsor's platform (e.g., log in, deposit, create a transaction)"
    ]
  },
  {
    name: "Distribution / Social Promotion",
    tasks: [
      "Like & repost the sponsor's tweet on X",
      "Create UGC (user-generated content) about the sponsor on social media (TikTok, Instagram, X)"
    ]
  },
  {
    name: "Referral",
    tasks: [
      "Refer or share the sponsor's service with friends"
    ]
  },
  {
    name: "Survey / Feedback",
    tasks: [
      "Complete a survey"
    ]
  },
  {
    name: "Physical Task Completion",
    tasks: [
      "Mystery shopping",
      "Local photo capture",
      "Site inspection"
    ]
  },
  {
    name: "Developer Tasks",
    tasks: [
      "Generate API key and make 1 API call",
      "Run SDK sample",
      "Execute CLI sample",
      "Fork template repository",
      "One-click deploy",
      "Report minor bug",
      "Fix typo in documentation"
    ]
  }
];

export const LANDING_BACKGROUND_CLASS_NAME = "landing-background-3d";
export const LANDING_BACKGROUND_COLOR = "#0a0a0f";

export const LANDING_CANVAS_CAMERA = { position: [0, 0, 5] as [number, number, number], fov: 50 };
export const LANDING_CANVAS_DPR = [1, 1.5] as [number, number];
export const LANDING_CANVAS_GL = {
  alpha: true,
  antialias: true,
  powerPreference: "low-power" as const
};

export const GET_STARTED_BUTTON_BASE_CLASS = "get-started-3d-btn";
export const GET_STARTED_BUTTON_LABEL = "Get Started";
export const GET_STARTED_BUTTON_ARIA_LABEL = "Get Started";
export const GET_STARTED_BUTTON_LABEL_CLASS = "get-started-3d-label";
export const GET_STARTED_BUTTON_CANVAS_CLASS = "get-started-3d-canvas";

export const GET_STARTED_CANVAS_CAMERA = { position: [0, 0, 2.5] as [number, number, number], fov: 40 };
export const GET_STARTED_CANVAS_DPR = [1, 2] as [number, number];
export const GET_STARTED_CANVAS_GL = { alpha: true, antialias: true };