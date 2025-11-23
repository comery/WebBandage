import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface AssemblyNode {
  id: string;
  length: number; // Base pairs
  coverage: number; // Read depth
  sequence?: string;
  group?: number;
}

export interface AssemblyLink {
  id: string;
  source: string;
  target: string;
  overlap: number;
}

export interface GraphData {
  nodes: AssemblyNode[];
  links: AssemblyLink[];
}

// Internal Physics Types
export interface SimulationNode extends SimulationNodeDatum {
  id: string;
  parentId: string;
  type: 'start' | 'end'; // Is this the start or end of the contig?
  r?: number; // Collision radius
  // D3 physics properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SimulationLink extends SimulationLinkDatum<SimulationNode> {
  id: string;
  type: 'backbone' | 'edge'; // Backbone = internal node structure, Edge = logical connection
  source: string | SimulationNode;
  target: string | SimulationNode;
  parentId?: string; // ID of the AssemblyNode this link belongs to (if backbone)
}

export enum ColorMode {
  DEPTH = 'DEPTH',
  LENGTH = 'LENGTH',
  UNIFORM = 'UNIFORM',
  RANDOM = 'RANDOM'
}

export interface GraphSettings {
  nodeWidthScale: number; // How "fat" the contig bars are
  nodeLengthScale: number; // Multiplier for bp length to pixel length
  linkDistance: number;
  chargeStrength: number;
  colorMode: ColorMode;
  showLabels: boolean;
  showArrows: boolean;
  // Detailed label settings
  labelContent: {
    custom: boolean;
    length: boolean;
    blast: boolean;
    name: boolean;
    depth: boolean;
    csv: boolean;
  };
  labelOutline: boolean;
  csvLabels: Record<string, string>; // Store uploaded CSV labels
}

export const DEFAULT_SETTINGS: GraphSettings = {
  nodeWidthScale: 12,
  nodeLengthScale: 0.05,
  linkDistance: 0, // Default tight
  chargeStrength: -100,
  colorMode: ColorMode.RANDOM,
  showLabels: true,
  showArrows: true,
  labelContent: {
    custom: false,
    length: false,
    blast: false,
    name: true,
    depth: false,
    csv: false
  },
  labelOutline: true,
  csvLabels: {}
};