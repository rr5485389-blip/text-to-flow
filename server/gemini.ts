import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { WorkflowSpec } from '../src/types/workflow';
import { computeWorkflowLayout } from '../src/utils/layoutEngine';
import { fallbackTextAnalyzer } from '../src/utils/fallbackAnalyzer';

export { fallbackTextAnalyzer };

// Server-side Gemini initialization with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY is not set in environment.');
  }
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const SYSTEM_PROMPT = `You are an expert Systems Architect, Workflow Engineer, and Figma UI/UX Design Lead.
Your mission is to read and analyze any provided text document, technical specification, user story, or business logic document, and transform it into a structured, visual workflow graph optimized for Figma and FigJam.

CRITICAL MANDATE 1 - CORE DATA DISTILLATION (DO NOT DUMP BULKY / VERBOSE DATA):
- When the input text contains a lot of data, extensive paragraphs, long descriptions, logs, or dense technical specifications:
  * You MUST extract and include ONLY THE ESSENTIAL CORE DATA.
  * DO NOT copy verbose sentences, narrative fluff, or bulky paragraphs into the workflow nodes.
  * "title": Concise, punchy core step name (max 4-6 words, e.g. "Step 3: Credential Verification", "MFA Verification Screen").
  * "description": Exactly ONE concise sentence capturing ONLY the core action, primary state change, or system outcome (e.g. "Validates hashed password against PostgreSQL Auth Store." or "Issues 6-digit TOTP challenge and renders input screen."). Omit conversational filler, duplicate step numbers, and narrative preamble.
  * "actor": Clean entity name (e.g. "User", "Auth Service", "PostgreSQL", "Notification Service").
  * "details": Array of 1 to 2 items containing ONLY the core data parameters, payload fields, thresholds, or critical constraints (e.g. "Payload: email, password_hash", "Rule: Lockout if failed >= 5", "Output: JWT access & refresh tokens"). Keep each detail concise (max 8-10 words of pure core data).
  * "edges": "label": Concise branch condition (e.g. "Valid", "Invalid (< 5)", "Account Locked", "MFA Enabled", "MFA Disabled", "Code Valid", "Invalid / Expired").

CRITICAL MANDATE 2 - EXHAUSTIVE EXTRACTION (DO NOT OMIT ANY STEPS):
- The input document may contain numbered steps (e.g. STEP 0, STEP 1, STEP 2, STEP 3, STEP 4, STEP 5, STEP 6...), sub-steps, conditional branches (e.g. "IF password invalid", "IF attempts >= 5", "IF MFA enabled", "IF code expired"), error handlers, screen transitions, and outcomes.
- You MUST extract EVERY SINGLE STEP, SUB-STEP, and DECISION PATH mentioned in the document.
- DO NOT collapse, summarize away, or skip any numbered step. Every single step listed in the text MUST have a corresponding node in the "nodes" array.
- For decision steps containing multiple IF conditions (e.g. Step 3 or Step 4 with valid vs invalid paths), generate nodes for both the decision evaluation and its respective outcome branches so that no logic is missing.
- Inside each node, adhere strictly to MANDATE 1: distill to its essential core data.

You must extract:
1. "title": A clear, executive title for this workflow.
2. "summary": A 2-sentence executive summary of the process and core objectives.
3. "category": The business or technical domain (e.g., "Authentication & Security", "Fintech & Payments", "Cloud Architecture", "E-Commerce", "Healthcare", "DevOps").
4. "actors": Array of distinct roles, services, third-party APIs, or human personas involved (e.g. ["User / Client", "Frontend Web App", "Identity Provider", "Security DB", "Email Service"]).
5. "nodes": A sequence of workflow steps. Each node must have:
   - "id": e.g. "node-1", "node-2", "node-3"
   - "type": One of:
     * "trigger" (Initiating event or user entry)
     * "action" (Computation, internal step, processing)
     * "decision" (Condition, IF/ELSE branch, verification check)
     * "screen_ui" (A visual screen or UI view that a user interacts with)
     * "database" (Data storage, query, record persistence)
     * "api" (External service or webhook call)
     * "end_state" (Terminal outcome: success, cancellation, or error terminal)
   - "title": Concise core step name (e.g. "Step 0: User Initialization", "Step 3: Credential Verification").
   - "description": 1 concise sentence stating strictly the core data operation or outcome.
   - "actor": The specific entity performing or owning this step.
   - "screenData": (REQUIRED if type is "screen_ui"):
     * "screenName": e.g. "Login Screen", "MFA Verification Screen", "User Dashboard"
     * "screenType": "form" | "dashboard" | "modal" | "list" | "status_view"
     * "elements": Array of UI elements, e.g. [{ "id": "el-1", "type": "input", "label": "Username / Email" }, { "id": "el-2", "type": "input", "label": "Password" }, { "id": "el-3", "type": "button", "label": "Log In", "variant": "primary" }]
   - "details": 1-2 concise core data parameters, constraints, or payload fields.
6. "edges": Direct connections between nodes. Each edge must have:
   - "id": e.g. "edge-1"
   - "source": source node id
   - "target": target node id
   - "label": Short branch condition or action label, e.g. "Password Valid", "Invalid (< 5)", "MFA Enabled", "MFA Disabled", "Success", "Locked Account"
   - "conditionType": "default" | "success" | "failure" | "branch_yes" | "branch_no" | "fallback"
7. "insights":
   - "potentialBottlenecks": 2-3 identified architectural or UX friction points.
   - "securityOrEdgeCases": 2-3 edge cases or security protections to consider.
   - "figmaDesignTips": 2-3 actionable design system recommendations for building this in Figma.

Return ONLY valid raw JSON with this exact schema without markdown backticks or explanation.`;

/**
 * Helper to call Gemini with automatic retry and model fallback when experiencing 503 demand spikes.
 */
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  prompt: string,
  systemInstruction: string
): Promise<string | null> {
  // Use official, fast Gemini models
  const modelsToAttempt = ['gemini-2.5-flash', 'gemini-2.0-flash'];

  for (const model of modelsToAttempt) {
    try {
      const geminiPromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      // Strict 8s timeout so serverless/Vercel functions never exceed execution limits
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout calling model ${model}`)), 8000)
      );

      const response = await Promise.race([geminiPromise, timeoutPromise]);
      const text = response.text?.trim() || '';
      if (text) {
        return text;
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${model} failed or timed out (${err?.message || 'Error'}). Trying next tier fallback...`);
    }
  }

  return null;
}

/**
 * Analyzes the text document and generates a visual workflow specification.
 */
export async function analyzeTextWorkflow(
  text: string,
  fileName?: string,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): Promise<WorkflowSpec> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = getGeminiClient();
      const prompt = `Carefully extract ALL steps and decision logic from the following document into a complete workflow graph. Ensure NO numbered steps (STEP 0, STEP 1, STEP 2, STEP 3, STEP 4, STEP 5...) or conditional branches are skipped:\n\nDOCUMENT NAME: ${
        fileName || 'Uploaded_Specification.txt'
      }\n\nCONTENT:\n${text}`;

      const responseText = await callGeminiWithFallback(ai, prompt, SYSTEM_PROMPT);

      if (responseText) {
        // Strip potential markdown fence just in case
        const cleanedJson = responseText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(cleanedJson);

        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          // Compute geometric auto-layout coordinates
          const layoutNodes = computeWorkflowLayout(parsed.nodes || [], parsed.edges || [], direction);

          return {
            id: 'wf-' + Date.now(),
            title: parsed.title || fileName?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Extracted Workflow Logic',
            summary: parsed.summary || 'Exhaustive workflow logic extracted from document specification.',
            category: parsed.category || 'System Architecture',
            actors: parsed.actors && parsed.actors.length > 0 ? parsed.actors : ['User', 'System Gateway'],
            nodes: layoutNodes,
            edges: parsed.edges || [],
            insights: {
              potentialBottlenecks: parsed.insights?.potentialBottlenecks || [
                'High latency potential during synchronous external service validations.',
                'User verification timeouts under high network traffic.',
              ],
              securityOrEdgeCases: parsed.insights?.securityOrEdgeCases || [
                'Validate all incoming parameters before state transitions.',
                'Enforce rate limiting and lockout counters across auth boundaries.',
              ],
              figmaDesignTips: parsed.insights?.figmaDesignTips || [
                'Use Figma Auto Layout with 16px padding on screen frame cards.',
                'Create reusable badge component variants for status states.',
                'Adopt consistent connector color coding for success (green) vs failure (red).',
              ],
            },
            rawTextPreview: text.slice(0, 1000),
            createdAt: new Date().toISOString(),
          };
        }
      }
    } catch (err: any) {
      console.warn('[Gemini] Model output parsing failed, smoothly utilizing exhaustive heuristic parser:', err?.message || err);
    }
  }

  // Fallback: Comprehensive heuristic logic extractor so that NO steps are ever missing
  return fallbackTextAnalyzer(text, fileName, direction);
}
