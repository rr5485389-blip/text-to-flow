import {
  WorkflowSpec,
  FigmaPushFramesResponse,
  FigmaVerifyResponse,
  FigmaOAuthUrlResponse,
} from '../types/workflow';

/**
 * Client service to communicate with the Figma REST API backend:
 * - OAuth 2.0 flow management & popup listener
 * - Automatic Workflow Nodes Frame pushing
 * - File verification and native schema inspection
 */

export interface FigmaOAuthStatus {
  configured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  callbackUrl: string;
}

/**
 * Retrieves the OAuth URL from the server
 */
export async function getFigmaOAuthUrl(customClientId?: string): Promise<FigmaOAuthUrlResponse> {
  const params = new URLSearchParams();
  if (customClientId) {
    params.set('client_id', customClientId.trim());
  }
  const res = await fetch(`/api/figma/oauth/url?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch OAuth URL (${res.status})`);
  }
  return await res.json();
}

/**
 * Checks server environment status for OAuth credentials
 */
export async function getFigmaOAuthStatus(): Promise<FigmaOAuthStatus> {
  try {
    const res = await fetch('/api/figma/oauth/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Could not fetch OAuth status:', e);
  }
  return {
    configured: false,
    hasClientId: false,
    hasClientSecret: false,
    callbackUrl: `${window.location.origin}/auth/callback`,
  };
}

/**
 * Automatically pushes workflow nodes as Frames directly into a Figma file via REST API
 */
export async function pushWorkflowNodesToFigmaFile(
  token: string,
  fileKey: string,
  workflow: WorkflowSpec
): Promise<FigmaPushFramesResponse> {
  const res = await fetch('/api/figma/push-frames', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token.trim(),
      fileKey: fileKey.trim(),
      workflow,
    }),
  });

  const data: FigmaPushFramesResponse = await res.json();
  return data;
}

/**
 * Verifies token access against the user profile and target file
 */
export async function verifyFigmaAccess(
  token: string,
  fileKey?: string
): Promise<FigmaVerifyResponse> {
  const res = await fetch('/api/figma/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token.trim(),
      fileKey: fileKey?.trim(),
    }),
  });

  return await res.json();
}

/**
 * Generates the native Figma Document Frame schema
 */
export async function fetchNativeFigmaSchema(workflow: WorkflowSpec): Promise<any> {
  const res = await fetch('/api/figma/generate-schema', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workflow }),
  });
  const data = await res.json();
  return data.schema;
}
