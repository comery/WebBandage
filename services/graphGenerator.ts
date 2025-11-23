import { GraphData, AssemblyNode, AssemblyLink } from '../types';

export const generateMockAssemblyGraph = (nodeCount: number = 40): GraphData => {
  const nodes: AssemblyNode[] = [];
  const links: AssemblyLink[] = [];

  // Generate a backbone chain (simulating a chromosome)
  let prevNodeId: string | null = null;
  const backboneLength = Math.floor(nodeCount * 0.7);

  for (let i = 0; i < backboneLength; i++) {
    const id = `ctg_${i + 1}`;
    const length = Math.floor(Math.random() * 40000) + 5000;
    const coverage = 40 + (Math.random() * 20 - 10);
    
    nodes.push({ id, length, coverage });

    if (prevNodeId) {
      links.push({
        id: `lnk_${i}`,
        source: prevNodeId,
        target: id,
        overlap: 55
      });
    }
    prevNodeId = id;
  }

  // Close the loop with 20% probability
  if (prevNodeId && Math.random() > 0.8) {
     links.push({
        id: `lnk_close`,
        source: prevNodeId,
        target: nodes[0].id,
        overlap: 55
      });
  }

  // Generate some complex bubbles/tangles
  const tangleCount = nodeCount - backboneLength;
  for (let i = 0; i < tangleCount; i++) {
    const id = `tangle_${i + 1}`;
    nodes.push({
      id,
      length: Math.floor(Math.random() * 2000) + 500, // Short repetitive elements
      coverage: 150 + Math.random() * 50
    });

    // Connect to random backbone node
    const targetIdx = Math.floor(Math.random() * backboneLength);
    links.push({
      id: `lnk_t_${i}`,
      source: `ctg_${targetIdx + 1}`,
      target: id,
      overlap: 55
    });
    
    // Maybe connect back to another part
    if (Math.random() > 0.5) {
       const targetIdx2 = (targetIdx + 1) % backboneLength;
       links.push({
        id: `lnk_t_back_${i}`,
        source: id,
        target: `ctg_${targetIdx2 + 1}`,
        overlap: 55
      });
    }
  }

  return { nodes, links };
};

export const formatBasePairs = (bp: number): string => {
  if (bp >= 1000000) return `${(bp / 1000000).toFixed(2)} Mbp`;
  if (bp >= 1000) return `${(bp / 1000).toFixed(2)} kbp`;
  return `${bp} bp`;
};

export const formatCoverage = (cov: number): string => {
  return `${cov.toFixed(1)}x`;
};