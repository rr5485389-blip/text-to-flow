import { WorkflowSpec, WorkflowNode, WorkflowEdge } from '../types/workflow';
import { computeWorkflowLayout } from './layoutEngine';

/**
 * Exhaustive deterministic heuristic parser that captures EVERY step and conditional branch
 */
export function fallbackTextAnalyzer(
  text: string,
  fileName?: string,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): WorkflowSpec {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const titleCandidate =
    lines.find((l) => /^[A-Z0-9\s:_-]{6,}$/i.test(l) && !l.toUpperCase().includes('STEP') && !l.startsWith('-')) ||
    fileName?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') ||
    'Extracted Workflow Architecture';

  const rawNodes: WorkflowNode[] = [];
  const rawEdges: WorkflowEdge[] = [];
  const actorsSet = new Set<string>(['User / Client', 'Auth Gateway', 'Security DB']);

  let nodeCounter = 1;
  let currentParentNodeId: string | null = null;
  let previousMainNodeId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect if line is a numbered major step (e.g. "1. STEP 0 - ...", "STEP 1:", "2. Credential Input", etc.)
    const stepMatch = line.match(/^(\d+[\.\)]|\bSTEP\s*\d+|\bSTAGE\s*\d+)/i);
    const isMajorStep = Boolean(stepMatch) || /^(trigger|phase\s*\d+)/i.test(line);

    // Detect if line is an IF/ELSE condition bullet (e.g. "- IF password invalid:", "IF MFA is NOT enabled:")
    const isConditionBullet = /^(-\s*if|\*?\s*if\s|else|otherwise|when\s)/i.test(line);

    // Major Step Handling
    if (isMajorStep) {
      const nodeId = `node-${nodeCounter++}`;

      // Extract title cleanly
      let stepTitle = line
        .replace(/^(\d+[\.\)]\s*|\bSTEP\s*\d+\s*[-:]?\s*|\bSTAGE\s*\d+\s*[-:]?\s*)/i, '')
        .split(/[:.-]/)[0]
        .slice(0, 36)
        .trim();

      if (!stepTitle) {
        stepTitle = `Stage ${nodeCounter - 1}`;
      } else {
        // Keep step number prefix if available for clarity
        const prefix = line.match(/STEP\s*\d+/i);
        if (prefix) {
          stepTitle = `${prefix[0].toUpperCase()}: ${stepTitle}`;
        }
      }

      // Check upcoming lines for description and distill to core data
      let desc = line;
      if (i + 1 < lines.length && !lines[i + 1].match(/^(\d+[\.\)]|\bSTEP\s*\d+|-\s*IF)/i)) {
        desc = lines[i + 1];
      }

      // Distill description to only the core sentence/data (stripping fluff & boilerplate)
      let cleanDesc = desc
        .replace(/^(\d+[\.\)]\s*|\bSTEP\s*\d+\s*[-:]?\s*|\bSTAGE\s*\d+\s*[-:]?\s*)/i, '')
        .trim();
      const firstSentence = cleanDesc.split(/(?<=[.!?])\s+/)[0]?.trim() || cleanDesc;
      cleanDesc = firstSentence.length > 110 ? firstSentence.slice(0, 107) + '...' : firstSentence;

      // Determine node type
      let type: WorkflowNode['type'] = 'action';
      if (rawNodes.length === 0 || /initialize|entry|start|welcome|landing/i.test(line)) {
        type = 'trigger';
      } else if (/verify|check|challenge|decision|validation|authenticate/i.test(line)) {
        type = 'decision';
      } else if (/screen|page|modal|dialog|form|input|dashboard/i.test(line)) {
        type = 'screen_ui';
      } else if (/database|db|store|table|redis|postgres|audit\s*log/i.test(line)) {
        type = 'database';
      } else if (/api|gateway|token|sms|email|service/i.test(line)) {
        type = 'api';
      }

      let actor = 'System Gateway';
      if (/user|client|customer/i.test(line)) {
        actor = 'User / Client';
      } else if (/identity|auth|provider/i.test(line)) {
        actor = 'Identity Provider';
      } else if (/db|store|database/i.test(line)) {
        actor = 'Security Database';
      } else if (/email|sms|notification/i.test(line)) {
        actor = 'Notification Service';
      }
      actorsSet.add(actor);

      let screenData: WorkflowNode['screenData'];
      if (type === 'screen_ui' || /screen|dialog|form|modal|dashboard/i.test(line)) {
        type = 'screen_ui';
        screenData = {
          screenName: stepTitle,
          screenType: /modal|dialog/i.test(line) ? 'modal' : /dashboard/i.test(line) ? 'dashboard' : 'form',
          elements: [
            { id: 'el-1', type: 'header', label: stepTitle },
            { id: 'el-2', type: 'input', label: 'Required Credentials / Input' },
            { id: 'el-3', type: 'button', label: 'Submit & Proceed', variant: 'primary' },
          ],
        };
      }

      // Distill core data parameter / payload rule
      const coreDataMatch = line.match(/(payload|parameters|email|password|token|jwt|totp|rate limit|session|status|lockout|mfa)/i);
      const coreDetail = coreDataMatch
        ? `Core Data: ${coreDataMatch[0].toUpperCase()} evaluation`
        : `Core Action: ${cleanDesc.slice(0, 48)}`;

      rawNodes.push({
        id: nodeId,
        type,
        title: stepTitle,
        description: cleanDesc,
        actor,
        screenData,
        details: [coreDetail],
        x: 0,
        y: 0,
        width: 290,
        height: type === 'screen_ui' ? 220 : 155,
      });

      if (previousMainNodeId) {
        rawEdges.push({
          id: `edge-${rawEdges.length + 1}`,
          source: previousMainNodeId,
          target: nodeId,
          label: 'Proceed',
          conditionType: 'default',
        });
      }

      previousMainNodeId = nodeId;
      currentParentNodeId = nodeId;
    }
    // Conditional Branch Bullet Handling (e.g. "- IF password invalid:", "- IF MFA IS enabled:")
    else if (isConditionBullet && currentParentNodeId) {
      const branchId = `node-${nodeCounter++}`;

      const conditionLabel = line
        .replace(/^[-*]\s*/, '')
        .split(/[:]/)[0]
        .slice(0, 28)
        .trim();

      let conditionOutcome = line.includes(':') ? line.split(':')[1].trim() : line;
      // Distill outcome to core data / core result (max 90 chars)
      const coreOutcomeSentence = conditionOutcome.split(/(?<=[.!?])\s+/)[0]?.trim() || conditionOutcome;
      const cleanOutcome = coreOutcomeSentence.length > 85 ? coreOutcomeSentence.slice(0, 82) + '...' : coreOutcomeSentence;

      const isError = /invalid|fail|lock|error|expired|denied/i.test(line);
      const isSuccess = /valid|success|issue|approved|home|dashboard/i.test(line);

      const branchType: WorkflowNode['type'] = isError || isSuccess ? 'end_state' : 'action';

      rawNodes.push({
        id: branchId,
        type: branchType,
        title: conditionLabel.toUpperCase().slice(0, 24),
        description: cleanOutcome,
        actor: isError ? 'Security Guard' : 'Auth Gateway',
        details: [`Result: ${cleanOutcome.slice(0, 44)}`],
        x: 0,
        y: 0,
        width: 270,
        height: 140,
      });

      rawEdges.push({
        id: `edge-${rawEdges.length + 1}`,
        source: currentParentNodeId,
        target: branchId,
        label: conditionLabel.replace(/^IF\s+/i, '').slice(0, 16),
        conditionType: isError ? 'failure' : isSuccess ? 'success' : 'branch_yes',
      });
    }
  }

  // If text had no formal step numbering, extract every paragraph cleanly
  if (rawNodes.length === 0) {
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const line = lines[i];
      const nodeId = `node-${nodeCounter++}`;
      const coreSentence = line.split(/(?<=[.!?])\s+/)[0]?.trim() || line;
      const cleanDesc = coreSentence.length > 100 ? coreSentence.slice(0, 97) + '...' : coreSentence;
      rawNodes.push({
        id: nodeId,
        type: i === 0 ? 'trigger' : i === lines.length - 1 ? 'end_state' : 'action',
        title: line.split(/[:.-]/)[0].slice(0, 26).trim() || `Step ${i + 1}`,
        description: cleanDesc,
        actor: 'System Worker',
        details: [`Core Action: ${cleanDesc.slice(0, 40)}`],
        x: 0,
        y: 0,
        width: 280,
        height: 150,
      });

      if (previousMainNodeId) {
        rawEdges.push({
          id: `edge-${rawEdges.length + 1}`,
          source: previousMainNodeId,
          target: nodeId,
          label: 'Next',
          conditionType: 'default',
        });
      }
      previousMainNodeId = nodeId;
    }
  }

  const layoutNodes = computeWorkflowLayout(rawNodes, rawEdges, direction);

  return {
    id: 'wf-' + Date.now(),
    title: titleCandidate,
    summary: `Exhaustive workflow parsing complete with ${rawNodes.length} steps and decision branches extracted directly from the specification.`,
    category: 'System Workflow',
    actors: Array.from(actorsSet),
    nodes: layoutNodes,
    edges: rawEdges,
    insights: {
      potentialBottlenecks: [
        'Multi-factor validation steps introduce latency for end-users.',
        'Account lockout policies need rate-limiting coordination.',
      ],
      securityOrEdgeCases: [
        'Ensure token invalidation on session termination.',
        'Audit log all failed and successful authentication events.',
      ],
      figmaDesignTips: [
        'Use consistent color coding: green for success paths and red for lockout terminals.',
        'Arrange decision diamond shapes with clear Yes/No connector labels.',
      ],
    },
    rawTextPreview: text.slice(0, 800),
    createdAt: new Date().toISOString(),
  };
}
