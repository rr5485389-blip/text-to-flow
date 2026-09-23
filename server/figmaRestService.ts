import {
  WorkflowSpec,
  WorkflowNode,
  WorkflowEdge,
  FigmaPushedFrame,
  FigmaPushFramesResponse,
} from '../src/types/workflow';

/**
 * Service to interact directly with the Figma REST API:
 * 1. OAuth 2.0 Authentication (Authorization Code flow, Token exchange, Refresh, Profile)
 * 2. Automatic Node-to-Frame generation and canvas pushing via Figma REST API
 * 3. Native Figma Document Schema generation (Frames, Auto-Layout, Elements)
 */

export interface FigmaOAuthTokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: string;
}

export interface FigmaUserProfile {
  id: string;
  handle: string;
  email?: string;
  img_url?: string;
}

/**
 * Normalizes authentication headers to support both Figma OAuth Bearer tokens
 * and Personal Access Tokens (PAT).
 */
export function getFigmaAuthHeaders(token: string): Record<string, string> {
  const cleanToken = token.trim();
  // If it's a Figma PAT (often starts with 'figd_'), provide X-Figma-Token
  // OAuth tokens use standard Bearer Authorization
  if (cleanToken.startsWith('figd_')) {
    return {
      'X-Figma-Token': cleanToken,
      'Authorization': `Bearer ${cleanToken}`,
    };
  }
  return {
    'Authorization': `Bearer ${cleanToken}`,
    'X-Figma-Token': cleanToken,
  };
}

/**
 * Cleans and extracts the file key from a Figma file URL or raw key
 */
export function extractFigmaFileKey(fileUrlOrKey: string): string {
  const trimmed = fileUrlOrKey.trim();
  const match = trimmed.match(/figma\.com\/(file|design|board)\/([a-zA-Z0-9_-]+)/);
  return match ? match[2] : trimmed;
}

/**
 * Generates the Figma OAuth 2.0 Authorization URL
 */
export function getFigmaOAuthAuthorizeUrl(
  redirectUri: string,
  state: string = 'figma_workflow_auth',
  customClientId?: string
): { url: string; clientId: string; redirectUri: string } {
  const clientId = customClientId || process.env.FIGMA_CLIENT_ID || '';
  const scopes = 'current_user:read,file_content:read,file_comments:write,file_dev_resources:write';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: state,
    response_type: 'code',
  });

  const url = `https://www.figma.com/oauth?${params.toString()}`;
  return { url, clientId, redirectUri };
}

/**
 * Exchanges an OAuth authorization code for Figma access & refresh tokens
 */
export async function exchangeFigmaOAuthCode(
  code: string,
  redirectUri: string,
  customClientId?: string,
  customClientSecret?: string
): Promise<{
  success: boolean;
  tokens?: FigmaOAuthTokenData;
  user?: FigmaUserProfile;
  error?: string;
}> {
  const clientId = customClientId || process.env.FIGMA_CLIENT_ID;
  const clientSecret = customClientSecret || process.env.FIGMA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Missing FIGMA_CLIENT_ID or FIGMA_CLIENT_SECRET in server environment variables.',
    };
  }

  try {
    const bodyParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return {
        success: false,
        error: `Figma OAuth token exchange failed (${tokenRes.status}): ${errText}`,
      };
    }

    const tokenData: FigmaOAuthTokenData = await tokenRes.json();

    // Fetch user profile using the new access token
    const user = await getFigmaUserProfile(tokenData.access_token);

    return {
      success: true,
      tokens: tokenData,
      user,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to exchange Figma OAuth code',
    };
  }
}

/**
 * Refreshes an expired Figma OAuth token
 */
export async function refreshFigmaOAuthToken(
  refreshToken: string,
  customClientId?: string,
  customClientSecret?: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  const clientId = customClientId || process.env.FIGMA_CLIENT_ID;
  const clientSecret = customClientSecret || process.env.FIGMA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { success: false, error: 'Missing Figma OAuth client credentials' };
  }

  try {
    const bodyParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Failed to refresh token: ${err}` };
    }

    const data = await res.json();
    return { success: true, accessToken: data.access_token };
  } catch (err: any) {
    return { success: false, error: err.message || 'Refresh error' };
  }
}

/**
 * Retrieves the current authenticated user's profile from Figma
 */
export async function getFigmaUserProfile(token: string): Promise<FigmaUserProfile | undefined> {
  try {
    const res = await fetch('https://api.figma.com/v1/me', {
      headers: getFigmaAuthHeaders(token),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        handle: data.handle || 'Figma Designer',
        email: data.email,
        img_url: data.img_url,
      };
    }
  } catch (e) {
    console.warn('[Figma REST] Could not fetch user profile:', e);
  }
  return undefined;
}

/**
 * Checks file access and retrieves file name
 */
export async function getFigmaFileInfo(
  token: string,
  fileKey: string
): Promise<{ accessible: boolean; name?: string; error?: string }> {
  const cleanKey = extractFigmaFileKey(fileKey);
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${cleanKey}?depth=1`, {
      headers: getFigmaAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.text();
      return { accessible: false, error: `Cannot access file (${res.status}): ${err}` };
    }

    const data = await res.json();
    return { accessible: true, name: data.name };
  } catch (err: any) {
    return { accessible: false, error: err.message || 'Network error fetching file' };
  }
}

/**
 * Builds native Figma Frame Node JSON schema for all workflow nodes
 */
export function generateNativeFigmaFramesSchema(workflow: WorkflowSpec) {
  const FRAME_WIDTH = 380;
  const FRAME_HEIGHT = 480;
  const GAP_X = 80;

  const frames = workflow.nodes.map((node, idx) => {
    const x = idx * (FRAME_WIDTH + GAP_X) + 100;
    const y = 150;

    return {
      id: `frame_${node.id}`,
      name: `Stage ${idx + 1}: ${node.title}`,
      type: 'FRAME',
      visible: true,
      blendMode: 'PASS_THROUGH',
      absoluteBoundingBox: {
        x,
        y,
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
      },
      layoutMode: 'VERTICAL',
      primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'FIXED',
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 24,
      paddingBottom: 24,
      itemSpacing: 16,
      cornerRadius: 16,
      fills: [
        {
          type: 'SOLID',
          visible: true,
          color: getNodeBackgroundColor(node.type),
        },
      ],
      strokes: [
        {
          type: 'SOLID',
          visible: true,
          color: { r: 0.88, g: 0.9, b: 0.94, a: 1 },
        },
      ],
      strokeWeight: 1.5,
      children: [
        {
          id: `tag_${node.id}`,
          name: 'Badge Container',
          type: 'FRAME',
          layoutMode: 'HORIZONTAL',
          itemSpacing: 8,
          children: [
            {
              id: `type_tag_${node.id}`,
              name: `Type: ${node.type.toUpperCase()}`,
              type: 'TEXT',
              characters: node.type.toUpperCase(),
              style: {
                fontFamily: 'Inter',
                fontWeight: 700,
                fontSize: 11,
              },
            },
            {
              id: `actor_tag_${node.id}`,
              name: `Actor: ${node.actor || 'System'}`,
              type: 'TEXT',
              characters: `Actor: ${node.actor || 'System'}`,
              style: {
                fontFamily: 'Inter',
                fontWeight: 600,
                fontSize: 11,
              },
            },
          ],
        },
        {
          id: `title_${node.id}`,
          name: 'Stage Title',
          type: 'TEXT',
          characters: node.title,
          style: {
            fontFamily: 'Inter',
            fontWeight: 700,
            fontSize: 18,
          },
        },
        {
          id: `desc_${node.id}`,
          name: 'Stage Description',
          type: 'TEXT',
          characters: node.description,
          style: {
            fontFamily: 'Inter',
            fontWeight: 400,
            fontSize: 13,
            lineHeightPx: 18,
          },
        },
        // UI Wireframe section if applicable
        ...(node.screenData
          ? [
              {
                id: `screen_${node.id}`,
                name: `UI Wireframe: ${node.screenData.screenName}`,
                type: 'FRAME',
                layoutMode: 'VERTICAL',
                itemSpacing: 10,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 16,
                paddingBottom: 16,
                cornerRadius: 12,
                fills: [
                  {
                    type: 'SOLID',
                    color: { r: 0.98, g: 0.98, b: 0.99, a: 1 },
                  },
                ],
                children: node.screenData.elements.map((elem, eIdx) => ({
                  id: `elem_${node.id}_${eIdx}`,
                  name: `Element: ${elem.label}`,
                  type: 'FRAME',
                  layoutMode: 'HORIZONTAL',
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  cornerRadius: 6,
                  fills: [
                    {
                      type: 'SOLID',
                      color:
                        elem.type === 'button'
                          ? { r: 0.31, g: 0.27, b: 0.9, a: 1 }
                          : { r: 1, g: 1, b: 1, a: 1 },
                    },
                  ],
                  children: [
                    {
                      id: `elem_text_${node.id}_${eIdx}`,
                      name: elem.label,
                      type: 'TEXT',
                      characters: `${elem.type.toUpperCase()}: ${elem.label}`,
                      style: {
                        fontFamily: 'Inter',
                        fontSize: 11,
                        fontWeight: 600,
                      },
                    },
                  ],
                })),
              },
            ]
          : []),
      ],
    };
  });

  return {
    document: {
      id: '0:0',
      name: 'Document',
      type: 'DOCUMENT',
      children: [
        {
          id: '0:1',
          name: `${workflow.title} - Workflow Flowchart`,
          type: 'CANVAS',
          children: frames,
        },
      ],
    },
  };
}

function getNodeBackgroundColor(type: string): { r: number; g: number; b: number; a: number } {
  switch (type) {
    case 'trigger':
      return { r: 0.94, g: 0.97, b: 1, a: 1 };
    case 'action':
      return { r: 1, g: 1, b: 1, a: 1 };
    case 'decision':
      return { r: 1, g: 0.97, b: 0.9, a: 1 };
    case 'screen_ui':
      return { r: 0.96, g: 0.93, b: 1, a: 1 };
    case 'database':
      return { r: 0.94, g: 0.99, b: 0.96, a: 1 };
    case 'end_state':
      return { r: 0.93, g: 0.99, b: 0.95, a: 1 };
    default:
      return { r: 1, g: 1, b: 1, a: 1 };
  }
}

/**
 * Pushes workflow nodes as dedicated Frames and canvas coordinates directly into
 * the user's Figma file using the Figma REST API.
 */
export async function pushWorkflowNodesAsFrames(
  token: string,
  fileKey: string,
  workflow: WorkflowSpec
): Promise<FigmaPushFramesResponse> {
  const cleanKey = extractFigmaFileKey(fileKey);
  if (!cleanKey) {
    return {
      success: false,
      fileKey: '',
      pushedCount: 0,
      totalNodes: workflow.nodes.length,
      frames: [],
      error: 'Invalid or missing Figma file key.',
    };
  }

  // 1. Verify file accessibility
  const fileInfo = await getFigmaFileInfo(token, cleanKey);
  if (!fileInfo.accessible) {
    return {
      success: false,
      fileKey: cleanKey,
      pushedCount: 0,
      totalNodes: workflow.nodes.length,
      frames: [],
      error: fileInfo.error || 'Cannot access the specified Figma file. Check permissions.',
    };
  }

  const pushedFrames: FigmaPushedFrame[] = [];
  const FRAME_WIDTH = 380;
  const GAP_X = 80;
  let masterCommentId: string | undefined;

  // 2. Post Master Architecture Overview Frame at coordinates (0, 0)
  try {
    const masterMessage = `🏗️ [FIGMA WORKFLOW CANVAS OVERVIEW]
═════════════════════════════════════════════
Workflow: ${workflow.title}
Category: ${workflow.category}
Summary: ${workflow.summary}
Actors: ${workflow.actors.join(', ')}

PIPELINE STAGES (${workflow.nodes.length} Nodes Generated):
${workflow.nodes.map((n, i) => `${i + 1}. [${n.type.toUpperCase()}] ${n.title} (Actor: ${n.actor || 'System'})`).join('\n')}

FLOW TRANSITIONS:
${workflow.edges.map((e) => `• ${e.source} ➔ ${e.target} ${e.label ? `[${e.label}]` : ''}`).join('\n')}

DESIGN & BOTTLENECK INSIGHTS:
${workflow.insights.potentialBottlenecks.map((b) => `• Alert: ${b}`).join('\n')}
${workflow.insights.figmaDesignTips.map((t) => `• Token: ${t}`).join('\n')}
═════════════════════════════════════════════`;

    const masterRes = await fetch(`https://api.figma.com/v1/files/${cleanKey}/comments`, {
      method: 'POST',
      headers: {
        ...getFigmaAuthHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: masterMessage,
        client_meta: {
          x: 0,
          y: 0,
        },
      }),
    });

    if (masterRes.ok) {
      const data = await masterRes.json();
      masterCommentId = data.id;
    }
  } catch (err) {
    console.warn('[Figma REST] Could not post master overview comment:', err);
  }

  // 3. Automatically push each Workflow Node as a dedicated Frame on the Canvas
  for (let idx = 0; idx < workflow.nodes.length; idx++) {
    const node = workflow.nodes[idx];
    const frameX = idx * (FRAME_WIDTH + GAP_X) + 120;
    const frameY = 160;

    // Incoming and outgoing transitions
    const inboundEdges = workflow.edges.filter((e) => e.target === node.id);
    const outboundEdges = workflow.edges.filter((e) => e.source === node.id);

    // Build rich Frame description
    let frameContent = `🖼️ [FRAME - STAGE ${idx + 1} of ${workflow.nodes.length}]
🏷️ ${node.title.toUpperCase()}
• Type: ${node.type.toUpperCase()}
• Actor: ${node.actor || 'System'}
• Canvas Coordinates: X=${frameX}, Y=${frameY} (Width=380, Height=480)

DESCRIPTION:
${node.description}
`;

    if (node.screenData && node.screenData.elements.length > 0) {
      frameContent += `\n🎨 UI WIREFRAME SPEC (${node.screenData.screenName} - ${node.screenData.screenType}):\n`;
      frameContent += node.screenData.elements
        .map((el) => `  [${el.type.toUpperCase()}] ${el.label}${el.value ? ` (Value: ${el.value})` : ''}`)
        .join('\n');
      frameContent += '\n';
    }

    if (outboundEdges.length > 0) {
      frameContent += `\n➡️ OUTGOING TRANSITIONS:\n`;
      frameContent += outboundEdges
        .map((e) => `  • To ${e.target} ${e.label ? `[Condition: ${e.label}]` : ''}`)
        .join('\n');
      frameContent += '\n';
    }

    if (inboundEdges.length > 0) {
      frameContent += `\n⬅️ INCOMING FROM: ${inboundEdges.map((e) => e.source).join(', ')}\n`;
    }

    try {
      // Direct REST API Post with client_meta spatial coordinates
      const commentRes = await fetch(`https://api.figma.com/v1/files/${cleanKey}/comments`, {
        method: 'POST',
        headers: {
          ...getFigmaAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: frameContent,
          client_meta: {
            x: frameX,
            y: frameY,
          },
        }),
      });

      if (commentRes.ok) {
        const commentData = await commentRes.json();
        pushedFrames.push({
          id: `frame_${node.id}`,
          nodeId: node.id,
          title: node.title,
          actor: node.actor,
          nodeType: node.type,
          coordinates: { x: frameX, y: frameY },
          commentId: commentData.id,
          status: 'pushed',
          summary: `Pushed Frame onto canvas at (${frameX}, ${frameY})`,
        });
      } else {
        const errText = await commentRes.text();
        console.warn(`[Figma REST] Failed to push frame for node ${node.id}:`, errText);
        pushedFrames.push({
          id: `frame_${node.id}`,
          nodeId: node.id,
          title: node.title,
          actor: node.actor,
          nodeType: node.type,
          coordinates: { x: frameX, y: frameY },
          status: 'failed',
          summary: `Error (${commentRes.status}): ${errText}`,
        });
      }
    } catch (pushErr: any) {
      pushedFrames.push({
        id: `frame_${node.id}`,
        nodeId: node.id,
        title: node.title,
        actor: node.actor,
        nodeType: node.type,
        coordinates: { x: frameX, y: frameY },
        status: 'failed',
        summary: pushErr.message || 'Push request failed',
      });
    }

    // Attempt Dev Resources creation if supported
    try {
      await fetch(`https://api.figma.com/v1/files/${cleanKey}/dev_resources`, {
        method: 'POST',
        headers: {
          ...getFigmaAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Spec: ${node.title}`,
          url: `https://figma.com/design/${cleanKey}?node-id=${node.id}`,
          node_id: node.id,
        }),
      });
    } catch {
      // Dev resources is optional per plan tier
    }
  }

  const nativeSchema = generateNativeFigmaFramesSchema(workflow);
  const successCount = pushedFrames.filter((f) => f.status === 'pushed').length;

  return {
    success: successCount > 0,
    fileKey: cleanKey,
    fileName: fileInfo.name,
    pushedCount: successCount,
    totalNodes: workflow.nodes.length,
    frames: pushedFrames,
    masterCommentId,
    figmaUrl: `https://www.figma.com/design/${cleanKey}`,
    figmaNodeSchema: nativeSchema,
    message: `Successfully pushed ${successCount} of ${workflow.nodes.length} workflow node Frames directly to Figma file "${fileInfo.name || cleanKey}"!`,
  };
}

/**
 * Handles the OAuth callback redirection from Figma, exchanges the code,
 * and sends credentials back to the opener window using postMessage.
 */
export async function handleFigmaOAuthCallback(req: any, res: any) {
  const code = (req.query?.code as string) || '';
  const error = (req.query?.error as string) || '';

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Figma OAuth Error</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #090d16; color: white;">
          <div style="text-align: center; padding: 24px; max-width: 400px; background: #131a2a; border-radius: 16px; border: 1px solid #1e293b;">
            <h3 style="color: #f43f5e; margin-top: 0;">Figma Authorization Cancelled</h3>
            <p style="color: #94a3b8; font-size: 13px;">${escapeHtml(error)}</p>
            <button onclick="window.close()" style="margin-top: 16px; padding: 8px 18px; border-radius: 8px; border: none; background: #334155; color: white; cursor: pointer; font-size: 12px; font-weight: 600;">Close Window</button>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code from Figma callback.');
  }

  const appUrl = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, '')
    : `${req.protocol || 'http'}://${req.get?.('host') || req.headers?.host || 'localhost:3000'}`;
  const redirectUri = `${appUrl}/auth/callback`;

  const exchangeResult = await exchangeFigmaOAuthCode(code, redirectUri);

  if (!exchangeResult.success || !exchangeResult.tokens) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Figma OAuth Failed</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #090d16; color: white;">
          <div style="text-align: center; padding: 24px; max-width: 440px; background: #131a2a; border-radius: 16px; border: 1px solid #1e293b;">
            <h3 style="color: #f43f5e; margin-top: 0;">OAuth Token Exchange Failed</h3>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">${escapeHtml(exchangeResult.error || 'Unknown token error')}</p>
            <button onclick="window.close()" style="margin-top: 16px; padding: 8px 18px; border-radius: 8px; border: none; background: #334155; color: white; cursor: pointer; font-size: 12px; font-weight: 600;">Close Window</button>
          </div>
        </body>
      </html>
    `);
  }

  const { tokens, user } = exchangeResult;

  return res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Figma Connected</title></head>
      <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #090d16; color: white;">
        <div style="text-align: center; padding: 32px; background: #131a2a; border-radius: 16px; border: 1px solid #1e293b; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: #ec4899; color: white; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-weight: bold; font-size: 20px;">
            F
          </div>
          <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #f8fafc;">Connected to Figma!</h3>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #94a3b8;">
            Authenticated as <strong>${escapeHtml(user?.handle || 'Figma Designer')}</strong>.
            Synchronizing with your workflow studio...
          </p>
          <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #ec4899; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                provider: 'figma',
                token: ${JSON.stringify(tokens.access_token)},
                refreshToken: ${JSON.stringify(tokens.refresh_token || '')},
                expiresIn: ${JSON.stringify(tokens.expires_in || 0)},
                user: ${JSON.stringify(user || null)}
              }, '*');
              setTimeout(() => {
                window.close();
              }, 600);
            } else {
              window.location.href = '/';
            }
          } catch (e) {
            console.error('postMessage error:', e);
          }
        </script>
      </body>
    </html>
  `);
}

function escapeHtml(str: string): string {
  return (str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
}
