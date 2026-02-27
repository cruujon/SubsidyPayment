function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function buildFrontendCampaignUrl(frontendUrl: string, campaignId: string): string {
  const base = normalizeBaseUrl(frontendUrl);
  if (!base || !campaignId) return '';
  try {
    const url = new URL(base);
    url.searchParams.set('view', 'dashboard');
    url.searchParams.set('campaign_id', campaignId);
    return url.toString();
  } catch {
    return '';
  }
}

export function buildFrontendDashboardUrl(frontendUrl: string): string {
  const base = normalizeBaseUrl(frontendUrl);
  if (!base) return '';
  try {
    const url = new URL(base);
    url.searchParams.set('view', 'dashboard');
    return url.toString();
  } catch {
    return '';
  }
}

export function buildBackendCampaignDetailsUrl(rustBackendUrl: string, campaignId: string): string {
  const base = normalizeBaseUrl(rustBackendUrl);
  if (!base || !campaignId) return '';
  return `${base}/campaigns/${encodeURIComponent(campaignId)}`;
}

export function buildBackendRunServiceUrl(rustBackendUrl: string, service: string): string {
  const base = normalizeBaseUrl(rustBackendUrl);
  if (!base || !service) return '';
  return `${base}/gpt/services/${encodeURIComponent(service)}/run`;
}
