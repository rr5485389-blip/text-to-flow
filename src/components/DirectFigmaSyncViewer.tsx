import React, { useState, useEffect } from 'react';
import {
  WorkflowSpec,
  FigmaVerifyResponse,
  FigmaPushFramesResponse,
  FigmaPushedFrame,
} from '../types/workflow';
import {
  getFigmaOAuthUrl,
  getFigmaOAuthStatus,
  pushWorkflowNodesToFigmaFile,
  verifyFigmaAccess,
  fetchNativeFigmaSchema,
} from '../services/figmaService';
import {
  Figma,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Key,
  Globe,
  HelpCircle,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Lock,
  Code2,
  Copy,
  ChevronDown,
  ChevronUp,
  Sliders,
  LogIn,
  MapPin
} from 'lucide-react';

interface DirectFigmaSyncViewerProps {
  workflow: WorkflowSpec;
  figmaConnected: boolean;
  figmaUser?: string;
  onFigmaConnected: (userHandle: string) => void;
}

export const DirectFigmaSyncViewer: React.FC<DirectFigmaSyncViewerProps> = ({
  workflow,
  figmaConnected,
  figmaUser,
  onFigmaConnected,
}) => {
  const [authMode, setAuthMode] = useState<'oauth' | 'pat'>('oauth');
  const [fileUrl, setFileUrl] = useState<string>(() => {
    return localStorage.getItem('figma_file_url') || '';
  });
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('figma_auth_token') || localStorage.getItem('figma_pat_token') || '';
  });

  const [currentUser, setCurrentUser] = useState<string | undefined>(figmaUser);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<FigmaVerifyResponse | null>(null);

  // OAuth state
  const [isOAuthLoading, setIsOAuthLoading] = useState<boolean>(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthConfigured, setOAuthConfigured] = useState<boolean>(false);
  const [customClientId, setCustomClientId] = useState<string>(() => {
    return localStorage.getItem('figma_client_id') || '';
  });
  const [showOAuthHelp, setShowOAuthHelp] = useState<boolean>(false);

  // Pushing frames state
  const [isPushingFrames, setIsPushingFrames] = useState<boolean>(false);
  const [pushResult, setPushResult] = useState<FigmaPushFramesResponse | null>(null);
  const [showNativeSchema, setShowNativeSchema] = useState<boolean>(false);
  const [nativeSchemaData, setNativeSchemaData] = useState<any | null>(null);
  const [copiedSchema, setCopiedSchema] = useState<boolean>(false);

  const [savedSettings, setSavedSettings] = useState<boolean>(false);

  // Extract pure file key from Figma URL
  const extractFileKey = (input: string) => {
    const trimmed = input.trim();
    const match = trimmed.match(/figma\.com\/(file|design|board)\/([a-zA-Z0-9_-]+)/);
    return match ? match[2] : trimmed;
  };

  const cleanFileKey = extractFileKey(fileUrl);
  const isValidFigmaUrl = fileUrl.includes('figma.com/') || cleanFileKey.length >= 10;

  // Check OAuth status from server
  useEffect(() => {
    getFigmaOAuthStatus().then((status) => {
      setOAuthConfigured(status.configured);
      if (!status.configured && !customClientId && !token) {
        // Fall back to PAT tab if OAuth client secrets aren't set yet
        setAuthMode('pat');
      }
    });
  }, []);

  // Listen for OAuth postMessage callback from popup
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('figma.com')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token) {
        const receivedToken = event.data.token;
        const handle = event.data.user?.handle || 'Figma Designer';
        setToken(receivedToken);
        setCurrentUser(handle);
        onFigmaConnected(handle);
        localStorage.setItem('figma_auth_token', receivedToken);
        setIsOAuthLoading(false);
        setOauthError(null);

        // Auto-verify target file if URL already entered
        if (fileUrl.trim()) {
          handleVerify(receivedToken, fileUrl.trim());
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [fileUrl, onFigmaConnected]);

  // Initiate OAuth Popup flow directly to provider URL
  const handleStartFigmaOAuth = async () => {
    setIsOAuthLoading(true);
    setOauthError(null);

    try {
      const { url, configured, callbackUrl, error } = await getFigmaOAuthUrl(customClientId);

      if (error || !url) {
        throw new Error(error || 'Failed to generate Figma OAuth URL');
      }

      if (!configured && !customClientId) {
        setOauthError(
          'FIGMA_CLIENT_ID is not configured in .env. Enter your Figma Client ID below or switch to the Personal Access Token tab.'
        );
        setShowOAuthHelp(true);
        setIsOAuthLoading(false);
        return;
      }

      // Save custom client ID if entered
      if (customClientId) {
        localStorage.setItem('figma_client_id', customClientId);
      }

      // Open Figma OAuth authorization URL directly in popup
      const popup = window.open(
        url,
        'figma_oauth_popup',
        'width=620,height=720,status=no,toolbar=no,menubar=no'
      );

      if (!popup) {
        setOauthError('Popup blocked by browser. Please allow popups for this site.');
        setIsOAuthLoading(false);
      }
    } catch (err: any) {
      setOauthError(err.message || 'OAuth initialization failed');
      setIsOAuthLoading(false);
    }
  };

  const handleVerify = async (userToken = token, userFileUrl = fileUrl) => {
    if (!userToken.trim()) return;
    setIsVerifying(true);
    setVerifyResult(null);

    const fileKey = extractFileKey(userFileUrl);
    try {
      const data = await verifyFigmaAccess(userToken, fileKey);
      setVerifyResult(data);
      if (data.valid && data.user) {
        setCurrentUser(data.user.handle);
        onFigmaConnected(data.user.handle);
        localStorage.setItem('figma_auth_token', userToken.trim());
        localStorage.setItem('figma_file_url', userFileUrl.trim());
        setSavedSettings(true);
        setTimeout(() => setSavedSettings(false), 3000);
      }
    } catch (err: any) {
      setVerifyResult({ valid: false, error: err.message || 'Connection failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Push all workflow nodes as Frames to the Figma file via REST API
  const handlePushWorkflowFrames = async () => {
    const fileKey = extractFileKey(fileUrl);
    if (!token.trim() || !fileKey) return;

    setIsPushingFrames(true);
    setPushResult(null);

    try {
      const response = await pushWorkflowNodesToFigmaFile(token, fileKey, workflow);
      setPushResult(response);
      if (response.figmaNodeSchema) {
        setNativeSchemaData(response.figmaNodeSchema);
      }
    } catch (err: any) {
      setPushResult({
        success: false,
        fileKey,
        pushedCount: 0,
        totalNodes: workflow.nodes.length,
        frames: [],
        error: err.message || 'Failed to push frames to Figma file.',
      });
    } finally {
      setIsPushingFrames(false);
    }
  };

  const handleInspectSchema = async () => {
    if (nativeSchemaData) {
      setShowNativeSchema(!showNativeSchema);
      return;
    }
    try {
      const schema = await fetchNativeFigmaSchema(workflow);
      setNativeSchemaData(schema);
      setShowNativeSchema(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopySchemaJson = () => {
    if (!nativeSchemaData) return;
    navigator.clipboard.writeText(JSON.stringify(nativeSchemaData, null, 2));
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  // Safe Figma Embed URL
  const figmaEmbedUrl =
    fileUrl && isValidFigmaUrl
      ? `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(
          fileUrl.startsWith('http') ? fileUrl : `https://www.figma.com/file/${fileUrl}`
        )}`
      : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Figma className="w-3.5 h-3.5" /> Figma REST API Service
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> OAuth 2.0 Authentication
            </span>
            {(figmaConnected || currentUser) && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Authenticated as {currentUser || figmaUser || 'Figma Designer'}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            Automated Node-to-Frame Figma Push Engine
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
            Automatically maps and delivers each of your {workflow.nodes.length} workflow stages as dedicated Frames onto your Figma canvas using the Figma REST API. No manual syncing or copy-pasting.
          </p>
        </div>

        {fileUrl && (
          <a
            href={fileUrl.startsWith('http') ? fileUrl : `https://www.figma.com/file/${fileUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
          >
            <span>Open in Figma</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: OAuth Auth & Automatic Frame Push (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            {/* Header with Auth Method Switcher */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-bold text-slate-900">
                  1. Figma Authentication
                </h4>
                {savedSettings && (
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Authenticate with Figma via OAuth 2.0 or enter an access token.
              </p>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-2 gap-2 mt-3 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAuthMode('oauth')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'oauth'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>OAuth 2.0 (Direct)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('pat')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'pat'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Personal Token</span>
                </button>
              </div>
            </div>

            {/* TAB A: OAuth 2.0 Flow */}
            {authMode === 'oauth' && (
              <div className="space-y-3.5 animate-in fade-in">
                {token ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold">OAuth Connected</p>
                        <p className="text-[11px] text-emerald-700">
                          {currentUser ? `Signed in as @${currentUser}` : 'Access token active'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setToken('');
                        setCurrentUser(undefined);
                        localStorage.removeItem('figma_auth_token');
                      }}
                      className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      id="btn-figma-oauth-popup"
                      type="button"
                      onClick={handleStartFigmaOAuth}
                      disabled={isOAuthLoading}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isOAuthLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Waiting for Figma Authorization...</span>
                        </>
                      ) : (
                        <>
                          <Figma className="w-4 h-4" />
                          <span>Connect Account with Figma OAuth</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Opens Figma login popup</span>
                      <button
                        type="button"
                        onClick={() => setShowOAuthHelp(!showOAuthHelp)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3" />
                        <span>OAuth App Settings</span>
                      </button>
                    </div>

                    {showOAuthHelp && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                        <p className="font-bold text-slate-900">Configuring Figma OAuth:</p>
                        <p className="text-[11px] text-slate-600">
                          To connect using your own registered Figma OAuth app, enter your Client ID below:
                        </p>
                        <input
                          type="text"
                          value={customClientId}
                          onChange={(e) => setCustomClientId(e.target.value)}
                          placeholder="Figma OAuth Client ID (optional if set in .env)"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-mono bg-white"
                        />
                        <p className="text-[10px] text-slate-500">
                          Redirect URL to register in Figma Developer settings:{' '}
                          <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                            {window.location.origin}/auth/callback
                          </code>
                        </p>
                      </div>
                    )}

                    {oauthError && (
                      <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <p>{oauthError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB B: Personal Access Token (PAT) */}
            {authMode === 'pat' && (
              <div className="space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Figma Access Token (PAT)
                  </label>
                  <span className="text-[10px] text-slate-400">Settings &gt; Personal access tokens</span>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="figd_..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono bg-white"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
            )}

            {/* Target Figma File URL */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Target Figma File Link
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://www.figma.com/design/XXXXX/My-File-Name"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono bg-white"
                />
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-400">
                Paste the URL of any Figma design or FigJam file from your browser.
              </p>
            </div>

            {/* Verification Button */}
            <button
              id="btn-verify-direct-figma"
              onClick={() => handleVerify()}
              disabled={!token.trim() || isVerifying}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                  <span>Verifying File Access...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Verify File Access</span>
                </>
              )}
            </button>

            {/* Connection Status Box */}
            {verifyResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  verifyResult.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {verifyResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  {verifyResult.valid ? (
                    <>
                      <p className="font-bold">Verified for: {verifyResult.user?.handle}</p>
                      {verifyResult.fileName && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Target File: <strong>"{verifyResult.fileName}"</strong>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-semibold">{verifyResult.error || 'Connection failed.'}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Automatic Push Nodes as Frames Button */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>2. Push Nodes as Frames to Figma</span>
                  <span className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold">
                    {workflow.nodes.length} Nodes
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sends each stage as a canvas Frame with full spatial coordinates, wireframe components, and transition connectors.
                </p>
              </div>

              <button
                id="btn-push-nodes-as-frames"
                onClick={handlePushWorkflowFrames}
                disabled={!token.trim() || !fileUrl.trim() || isPushingFrames}
                className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 active:bg-pink-800 disabled:opacity-50 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {isPushingFrames ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Pushing {workflow.nodes.length} Frames to Canvas...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>Push Workflow Nodes as Frames to Figma</span>
                  </>
                )}
              </button>

              {/* Push Results Breakdown */}
              {pushResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2 animate-in fade-in ${
                    pushResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {pushResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {pushResult.success
                          ? `Successfully Pushed ${pushResult.pushedCount} of ${pushResult.totalNodes} Frames!`
                          : 'Push Incomplete'}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {pushResult.message || pushResult.error}
                      </p>
                    </div>
                  </div>

                  {/* List of Pushed Frame Coordinates */}
                  {pushResult.frames && pushResult.frames.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200/60 space-y-1">
                      <p className="text-[11px] font-bold text-emerald-800">
                        Generated Canvas Frames:
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {pushResult.frames.map((frame, fIdx) => (
                          <div
                            key={frame.id || fIdx}
                            className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-emerald-100 text-[11px]"
                          >
                            <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                              {frame.title}
                            </span>
                            <span className="text-[10px] font-mono text-indigo-600 flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5" />
                              ({frame.coordinates.x}, {frame.coordinates.y})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pushResult.figmaUrl && (
                    <a
                      href={pushResult.figmaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 hover:text-pink-900 pt-1"
                    >
                      <span>Open Live Results in Figma</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Advanced: Inspect Native Figma Frame Node Schema */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleInspectSchema}
                  className="text-[11px] text-slate-600 hover:text-indigo-600 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Inspect Native Figma Frame Nodes Tree (JSON)</span>
                  {showNativeSchema ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showNativeSchema && nativeSchemaData && (
                  <div className="mt-2 p-3 bg-slate-900 rounded-xl text-slate-200 text-[11px] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono text-[10px]">DOCUMENT &gt; CANVAS &gt; FRAME[]</span>
                      <button
                        type="button"
                        onClick={handleCopySchemaJson}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSchema ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSchema ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <pre className="max-h-48 overflow-y-auto font-mono text-[10px] text-indigo-300 p-2 bg-black/40 rounded-lg">
                      {JSON.stringify(nativeSchemaData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Embedded Figma File Viewer (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                <Figma className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Live Figma File Canvas (Interactive)
                </h4>
                <p className="text-[11px] text-slate-500">
                  {verifyResult?.fileName
                    ? `Live view of file: "${verifyResult.fileName}"`
                    : 'Your live Figma canvas renders directly here in real time'}
                </p>
              </div>
            </div>

            {fileUrl && (
              <a
                href={fileUrl.startsWith('http') ? fileUrl : `https://www.figma.com/file/${fileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Full screen in Figma</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Embedded Figma Canvas Frame */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden h-[660px] relative flex flex-col items-center justify-center">
            {figmaEmbedUrl ? (
              <iframe
                title="Live Figma File Preview"
                src={figmaEmbedUrl}
                className="w-full h-full border-0 bg-slate-900"
                allowFullScreen
              />
            ) : (
              <div className="text-center p-8 max-w-md space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 text-pink-400 flex items-center justify-center mx-auto shadow-inner">
                  <Figma className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-white">
                    Live Figma Canvas Viewer
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Paste your target Figma file URL on the left. The live interactive Figma file will display right inside this window so you can watch your Frames sync directly.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 text-[11px] text-slate-300 text-left space-y-1.5">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    Automated Figma REST Engine:
                  </p>
                  <p className="text-slate-400 leading-relaxed">
                    • <strong>OAuth 2.0 Authentication</strong>: Secure popup authorization.<br />
                    • <strong>Canvas Coordinate Mapping</strong>: Stages placed at (120, 160), (580, 160)...<br />
                    • <strong>Node Frames</strong>: Auto-layout cards with wireframes, actors, and transitions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
