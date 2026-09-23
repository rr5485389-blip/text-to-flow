export type NodeType =
  | 'trigger'
  | 'action'
  | 'decision'
  | 'screen_ui'
  | 'database'
  | 'api'
  | 'end_state';

export type ConditionType =
  | 'default'
  | 'success'
  | 'failure'
  | 'branch_yes'
  | 'branch_no'
  | 'fallback';

export interface ScreenElement {
  id: string;
  type: 'header' | 'input' | 'button' | 'badge' | 'text' | 'card' | 'table';
  label: string;
  value?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'neutral';
}

export interface ScreenData {
  screenName: string;
  screenType: 'form' | 'dashboard' | 'modal' | 'list' | 'status_view';
  elements: ScreenElement[];
}

export type BoxSizeVariation = 'compact' | 'standard' | 'large' | 'expanded' | 'custom';
export type ArrowRoutingStyle = 'curved' | 'orthogonal' | 'straight';
export type ArrowStrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface ArrowSettings {
  routingStyle: ArrowRoutingStyle;
  strokeStyle: ArrowStrokeStyle;
  strokeWidth: number;
  animated: boolean;
  colorMode?: 'condition' | 'custom';
  customColor?: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  actor?: string;
  screenData?: ScreenData;
  details?: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  layer?: number;
  sizeVariation?: BoxSizeVariation;
  customColor?: string;
  customBg?: string;
  customBorder?: string;
  customTextColor?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  conditionType?: ConditionType;
  routingStyle?: ArrowRoutingStyle;
  strokeStyle?: ArrowStrokeStyle;
  strokeWidth?: number;
  customColor?: string;
  animated?: boolean;
}

export interface WorkflowSpec {
  id: string;
  title: string;
  summary: string;
  category: string;
  actors: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  arrowSettings?: ArrowSettings;
  insights: {
    potentialBottlenecks: string[];
    securityOrEdgeCases: string[];
    figmaDesignTips: string[];
  };
  rawTextPreview?: string;
  createdAt: string;
}

export interface AnalyzeRequest {
  text: string;
  fileName?: string;
  options?: {
    diagramStyle?: 'detailed' | 'compact' | 'ui_focused';
    direction?: 'horizontal' | 'vertical';
  };
}

export interface AnalyzeResponse {
  success: boolean;
  workflow?: WorkflowSpec;
  error?: string;
}

export interface FigmaVerifyRequest {
  personalAccessToken: string;
  fileKey?: string;
}

export interface FigmaVerifyResponse {
  valid: boolean;
  user?: {
    id: string;
    handle: string;
    email?: string;
    img_url?: string;
  };
  fileName?: string;
  error?: string;
}

export interface FigmaPostRequest {
  personalAccessToken: string;
  fileKey: string;
  commentMessage: string;
}

export interface FigmaPostResponse {
  success: boolean;
  commentId?: string;
  message?: string;
  error?: string;
}

export interface FigmaOAuthUrlResponse {
  success: boolean;
  url?: string;
  state?: string;
  configured: boolean;
  callbackUrl?: string;
  error?: string;
}

export interface FigmaPushedFrame {
  id: string;
  nodeId: string;
  title: string;
  actor?: string;
  nodeType: NodeType;
  coordinates: { x: number; y: number };
  commentId?: string;
  status: 'pushed' | 'failed' | 'simulated';
  summary: string;
}

export interface FigmaPushFramesResponse {
  success: boolean;
  fileKey: string;
  fileName?: string;
  pushedCount: number;
  totalNodes: number;
  frames: FigmaPushedFrame[];
  masterCommentId?: string;
  figmaUrl?: string;
  figmaNodeSchema?: any;
  message?: string;
  error?: string;
}
