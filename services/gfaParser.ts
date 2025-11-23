import { GraphData, AssemblyNode, AssemblyLink } from '../types';

export const parseGFA = (gfaContent: string): GraphData => {
  const nodes: AssemblyNode[] = [];
  const links: AssemblyLink[] = [];
  const nodeMap = new Map<string, AssemblyNode>();

  const lines = gfaContent.split('\n');

  lines.forEach(line => {
    const parts = line.trim().split('\t');
    if (parts.length === 0) return;

    const type = parts[0];

    if (type === 'S') {
      // Segment: S <Name> <Sequence> [Tags]
      const id = parts[1];
      const sequence = parts[2] === '*' ? undefined : parts[2];
      
      // Default values
      let length = sequence ? sequence.length : 0;
      let coverage = 1.0;

      // Parse Tags (Format: TAG:TYPE:VALUE)
      // Common tags: LN:i:length, DP:f:depth, KC:i:kmer_count
      for (let i = 3; i < parts.length; i++) {
        const tagParts = parts[i].split(':');
        if (tagParts.length >= 3) {
          const tagName = tagParts[0];
          const tagType = tagParts[1];
          const tagValue = tagParts[2];

          if (tagName === 'LN' && tagType === 'i') {
            length = parseInt(tagValue, 10);
          } else if (tagName === 'DP' && tagType === 'f') {
            coverage = parseFloat(tagValue);
          } else if (tagName === 'KC' && tagType === 'i') {
            // Estimate coverage from Kmer count if DP not available
            const kc = parseInt(tagValue, 10);
            if (coverage === 1.0 && length > 0) {
               coverage = kc / length; 
            }
          }
        }
      }

      const node: AssemblyNode = { id, length, coverage, sequence };
      nodes.push(node);
      nodeMap.set(id, node);
    } else if (type === 'L') {
      // Link: L <From> <FromOri> <To> <ToOri> <Overlap>
      if (parts.length >= 6) {
        const source = parts[1];
        const target = parts[3];
        const overlapStr = parts[5];
        
        let overlap = 0;
        const overlapMatch = overlapStr.match(/(\d+)/);
        if (overlapMatch) {
          overlap = parseInt(overlapMatch[1], 10);
        }

        links.push({
          id: `link_${source}_${target}_${links.length}`,
          source,
          target,
          overlap
        });
      }
    }
  });

  return { nodes, links };
};