import { WorkflowNode, WorkflowEdge } from '../types/workflow';

/**
 * Computes an organized, non-overlapping hierarchical layout for workflow nodes
 * based on edge connections (directed acyclic graph layer calculation).
 */
export function computeWorkflowLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  direction: 'horizontal' | 'vertical' = 'horizontal'
): WorkflowNode[] {
  if (nodes.length === 0) return [];

  // Build graph representations
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  const nodeMap = new Map<string, WorkflowNode>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    adjList.set(n.id, []);
    nodeMap.set(n.id, { ...n });
  });

  edges.forEach((e) => {
    if (adjList.has(e.source) && inDegree.has(e.target)) {
      adjList.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    }
  });

  // Assign layers using BFS/Longest Path
  const layers = new Map<string, number>();
  const queue: { id: string; layer: number }[] = [];

  // Find root nodes (in-degree 0 or trigger type)
  nodes.forEach((n) => {
    if ((inDegree.get(n.id) || 0) === 0 || n.type === 'trigger') {
      queue.push({ id: n.id, layer: 0 });
      layers.set(n.id, 0);
    }
  });

  // If cycle or no in-degree 0, pick the first node
  if (queue.length === 0 && nodes.length > 0) {
    queue.push({ id: nodes[0].id, layer: 0 });
    layers.set(nodes[0].id, 0);
  }

  // BFS to propagate layer indices
  const visited = new Set<string>();
  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    visited.add(id);

    const neighbors = adjList.get(id) || [];
    for (const neighbor of neighbors) {
      const currentLayer = layers.get(neighbor) ?? 0;
      const nextLayer = Math.max(currentLayer, layer + 1);
      layers.set(neighbor, nextLayer);

      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, layer: nextLayer });
      }
    }
  }

  // Ensure every node has a layer
  let maxAssignedLayer = 0;
  layers.forEach((l) => {
    if (l > maxAssignedLayer) maxAssignedLayer = l;
  });

  nodes.forEach((n, idx) => {
    if (!layers.has(n.id)) {
      layers.set(n.id, (idx % (maxAssignedLayer + 1)));
    }
  });

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  layers.forEach((layerIndex, nodeId) => {
    if (!layerGroups.has(layerIndex)) {
      layerGroups.set(layerIndex, []);
    }
    layerGroups.get(layerIndex)!.push(nodeId);
  });

  const sortedLayerKeys = Array.from(layerGroups.keys()).sort((a, b) => a - b);

  // Position nodes
  const nodeWidth = 280;
  const standardHeight = 150;
  const screenHeight = 220;
  const horizontalGap = 160;
  const verticalGap = 60;

  const resultNodes: WorkflowNode[] = [];

  if (direction === 'horizontal') {
    sortedLayerKeys.forEach((layerKey) => {
      const nodeIdsInLayer = layerGroups.get(layerKey)!;
      const count = nodeIdsInLayer.length;

      // Calculate total height of this layer to center vertically
      let totalLayerHeight = 0;
      nodeIdsInLayer.forEach((nid) => {
        const n = nodeMap.get(nid)!;
        const h = n.type === 'screen_ui' ? screenHeight : standardHeight;
        totalLayerHeight += h;
      });
      totalLayerHeight += (count - 1) * verticalGap;

      let currentY = Math.max(40, 400 - totalLayerHeight / 2);

      nodeIdsInLayer.forEach((nid) => {
        const n = nodeMap.get(nid)!;
        const height = n.type === 'screen_ui' ? screenHeight : standardHeight;
        const posX = 60 + layerKey * (nodeWidth + horizontalGap);
        const posY = currentY;

        resultNodes.push({
          ...n,
          x: posX,
          y: posY,
          width: nodeWidth,
          height: height,
          layer: layerKey,
        });

        currentY += height + verticalGap;
      });
    });
  } else {
    // Vertical layout
    sortedLayerKeys.forEach((layerKey) => {
      const nodeIdsInLayer = layerGroups.get(layerKey)!;
      const count = nodeIdsInLayer.length;
      const totalWidth = count * nodeWidth + (count - 1) * 80;
      let currentX = Math.max(40, 600 - totalWidth / 2);

      nodeIdsInLayer.forEach((nid) => {
        const n = nodeMap.get(nid)!;
        const height = n.type === 'screen_ui' ? screenHeight : standardHeight;
        const posX = currentX;
        const posY = 60 + layerKey * (standardHeight + 100);

        resultNodes.push({
          ...n,
          x: posX,
          y: posY,
          width: nodeWidth,
          height: height,
          layer: layerKey,
        });

        currentX += nodeWidth + 80;
      });
    });
  }

  return resultNodes;
}
