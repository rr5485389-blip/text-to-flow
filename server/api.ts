import express, { Request, Response } from 'express';
import path from 'path';
import { analyzeTextWorkflow } from './gemini.ts';
import { verifyFigmaToken, postCommentToFigmaFile } from './figma.ts';
import {
  getFigmaOAuthAuthorizeUrl,
  exchangeFigmaOAuthCode,
  pushWorkflowNodesAsFrames,
  generateNativeFigmaFramesSchema,
  handleFigmaOAuthCallback,
  getFigmaFileInfo,
} from './figmaRestService.ts';

export const apiApp = express();
apiApp.use(express.json({ limit: '10mb' }));

// Helper to determine the public app origin
function getAppOrigin(req: Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
}

// POST /analyze (when mounted at /api, this handles /api/analyze)
apiApp.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { text, fileName, options } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ success: false, error: 'Text content is required for analysis.' });
    }

    const direction = options?.direction || 'horizontal';
    const workflow = await analyzeTextWorkflow(text, fileName, direction);
    return res.json({ success: true, workflow });
  } catch (error: any) {
    console.error('[API /api/analyze error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// GET /download-zip - Direct download of full project codebase as a single zip archive
apiApp.get('/download-zip', (req: Request, res: Response) => {
  const zipPath = path.resolve(process.cwd(), 'public/figma-workflow-agent.zip');
  res.download(zipPath, 'figma-workflow-agent.zip');
});

// GET /figma/oauth/url - Generates Figma OAuth authorization URL
apiApp.get(['/figma/oauth/url', '/auth/url'], (req: Request, res: Response) => {
  try {
    const appOrigin = getAppOrigin(req);
    const callbackUrl = (req.query.redirect_uri as string) || `${appOrigin}/auth/callback`;
    const customClientId = req.query.client_id as string | undefined;

    const clientId = customClientId || process.env.FIGMA_CLIENT_ID || '';
    const configured = Boolean(clientId);

    const { url } = getFigmaOAuthAuthorizeUrl(callbackUrl, 'figma_workflow_auth', clientId);

    return res.json({
      success: true,
      url,
      configured,
      callbackUrl,
      clientIdProvided: configured,
    });
  } catch (error: any) {
    console.error('[API /api/figma/oauth/url error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to generate OAuth URL' });
  }
});

// GET /auth/callback - Handles OAuth code redirect from Figma
apiApp.get(['/auth/callback', '/auth/callback/', '/figma/oauth/callback'], async (req: Request, res: Response) => {
  try {
    return await handleFigmaOAuthCallback(req, res);
  } catch (error: any) {
    console.error('[API OAuth callback error]:', error);
    return res.status(500).send(`OAuth callback failed: ${error.message}`);
  }
});

// POST /figma/oauth/token - Manual code exchange if desired
apiApp.post('/figma/oauth/token', async (req: Request, res: Response) => {
  try {
    const { code, redirectUri, clientId, clientSecret } = req.body || {};
    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing authorization code.' });
    }
    const appOrigin = getAppOrigin(req);
    const cb = redirectUri || `${appOrigin}/auth/callback`;
    const result = await exchangeFigmaOAuthCode(code, cb, clientId, clientSecret);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Token exchange failed' });
  }
});

// GET /figma/oauth/status - Checks OAuth environment configuration
apiApp.get('/figma/oauth/status', (req: Request, res: Response) => {
  const appOrigin = getAppOrigin(req);
  return res.json({
    configured: Boolean(process.env.FIGMA_CLIENT_ID && process.env.FIGMA_CLIENT_SECRET),
    hasClientId: Boolean(process.env.FIGMA_CLIENT_ID),
    hasClientSecret: Boolean(process.env.FIGMA_CLIENT_SECRET),
    callbackUrl: `${appOrigin}/auth/callback`,
  });
});

// POST /figma/push-frames - Automatically pushes workflow nodes as Frames to Figma file via REST API
apiApp.post('/figma/push-frames', async (req: Request, res: Response) => {
  try {
    const { token, personalAccessToken, fileKey, workflow } = req.body || {};
    const authToken = token || personalAccessToken;

    if (!authToken) {
      return res.status(400).json({
        success: false,
        error: 'Authentication token required (Figma OAuth token or Personal Access Token).',
      });
    }

    if (!fileKey) {
      return res.status(400).json({
        success: false,
        error: 'Target Figma file URL or file key is required.',
      });
    }

    if (!workflow || !Array.isArray(workflow.nodes)) {
      return res.status(400).json({
        success: false,
        error: 'Valid workflow specification with nodes is required.',
      });
    }

    const pushResult = await pushWorkflowNodesAsFrames(authToken, fileKey, workflow);
    return res.json(pushResult);
  } catch (error: any) {
    console.error('[API /api/figma/push-frames error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to push frames to Figma' });
  }
});

// POST /figma/generate-schema - Returns native Figma Node Frame JSON tree
apiApp.post('/figma/generate-schema', (req: Request, res: Response) => {
  try {
    const { workflow } = req.body || {};
    if (!workflow || !Array.isArray(workflow.nodes)) {
      return res.status(400).json({ success: false, error: 'Workflow spec required' });
    }
    const schema = generateNativeFigmaFramesSchema(workflow);
    return res.json({ success: true, schema });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /figma/verify
apiApp.post('/figma/verify', async (req: Request, res: Response) => {
  try {
    const { personalAccessToken, token, fileKey } = req.body || {};
    const authToken = personalAccessToken || token;
    const result = await verifyFigmaToken(authToken, fileKey);
    return res.json(result);
  } catch (error: any) {
    console.error('[API /api/figma/verify error]:', error);
    return res.status(500).json({ valid: false, error: error.message || 'Verification failed' });
  }
});

// POST /figma/post
apiApp.post('/figma/post', async (req: Request, res: Response) => {
  try {
    const { personalAccessToken, token, fileKey, commentMessage } = req.body || {};
    const authToken = personalAccessToken || token;
    const result = await postCommentToFigmaFile(authToken, fileKey, commentMessage);
    return res.json(result);
  } catch (error: any) {
    console.error('[API /api/figma/post error]:', error);
    return res.status(500).json({ success: false, error: error.message || 'Post failed' });
  }
});

export const apiRouter = apiApp;
