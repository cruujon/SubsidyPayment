import * as THREE from "three";
import type { AppDeepLink, AppView } from "./types";

export function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((pct / 100) * (sorted.length - 1)))
  );
  return sorted[index];
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function parseAppDeepLink(search: string): AppDeepLink {
  const params = new URLSearchParams(search);
  const rawView = (params.get("view") || "").trim();
  const rawCampaignId = (params.get("campaign_id") || "").trim();
  const validViews: AppView[] = ["landing", "signup", "dashboard", "create-campaign", "login", "caller"];
  const parsedView = validViews.includes(rawView as AppView) ? (rawView as AppView) : null;
  const campaignId = rawCampaignId.length > 0 ? rawCampaignId : null;

  if (campaignId) {
    return { view: "dashboard", campaignId };
  }

  return { view: parsedView, campaignId: null };
}

export function taskCategoryFromText(task: string): string {
  const lower = task.toLowerCase();
  if (lower.includes("email") || lower.includes("telegram") || lower.includes("contact")) {
    return "Contact Sharing";
  }
  if (lower.includes("survey") || lower.includes("feedback") || lower.includes("research")) {
    return "Survey / Feedback";
  }
  if (
    lower.includes("signup") ||
    lower.includes("sign up") ||
    lower.includes("onboard") ||
    lower.includes("account")
  ) {
    return "Signup / Onboarding";
  }
  if (
    lower.includes("api key") ||
    lower.includes("sdk") ||
    lower.includes("cli") ||
    lower.includes("github") ||
    lower.includes("pr") ||
    lower.includes("bug")
  ) {
    return "Developer Task";
  }
  if (
    lower.includes("tweet") ||
    lower.includes("sns") ||
    lower.includes("ugc") ||
    lower.includes("social") ||
    lower.includes("post") ||
    lower.includes("review")
  ) {
    return "Social / UGC";
  }
  if (
    lower.includes("photo") ||
    lower.includes("local") ||
    lower.includes("mystery") ||
    lower.includes("inspection")
  ) {
    return "Field Task";
  }
  return "Other";
}

export function splitCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function mergeClassName(baseClass: string, className: string): string {
  return `${baseClass} ${className}`;
}

export function hoveredRotationX(currentRotationX: number, isHovered: boolean): number {
  return THREE.MathUtils.lerp(currentRotationX, isHovered ? 0.2 : 0, 0.08);
}

export function hoveredScale(isHovered: boolean): number {
  return isHovered ? 1.15 : 1;
}

export function ambientRotationX(elapsedTime: number): number {
  return Math.sin(elapsedTime * 0.15) * 0.08;
}