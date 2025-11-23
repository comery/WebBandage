import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphSettings, AssemblyNode, AssemblyLink, ColorMode, SimulationNode, SimulationLink } from '../types';
import { formatBasePairs, formatCoverage } from '../services/graphGenerator';
import { Plus, Minus, Maximize } from 'lucide-react';

interface GraphVisualizerProps {
  data: GraphData;
  settings: GraphSettings;
  onSelectionChange: (nodes: AssemblyNode[]) => void;
  selectedNodes: AssemblyNode[];
  isBrushMode: boolean;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ 
  data, 
  settings, 
  onSelectionChange, 
  selectedNodes,
  isBrushMode
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const [transform, setTransform] = useState(d3.zoomIdentity);

  // Map to store lookup of original data
  const nodeLookup = useRef<Map<string, AssemblyNode>>(new Map());

  // Compute colors for RANDOM mode using greedy graph coloring
  const randomColorMap = useMemo(() => {
    if (settings.colorMode !== ColorMode.RANDOM) return new Map<string, string>();

    const adjacency = new Map<string, Set<string>>();
    data.nodes.forEach(n => adjacency.set(n.id, new Set()));
    
    data.links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      adjacency.get(sourceId)?.add(targetId);
      adjacency.get(targetId)?.add(sourceId);
    });

    const colors = new Map<string, string>();
    const palette = d3.schemeTableau10; 

    const sortedNodes = [...data.nodes].sort((a, b) => {
      const degA = adjacency.get(a.id)?.size || 0;
      const degB = adjacency.get(b.id)?.size || 0;
      return degB - degA;
    });

    sortedNodes.forEach(node => {
      const neighborColors = new Set<string>();
      adjacency.get(node.id)?.forEach(neighborId => {
        if (colors.has(neighborId)) {
          neighborColors.add(colors.get(neighborId)!);
        }
      });

      let chosenColor = palette[0];
      for (let i = 0; i < palette.length; i++) {
        if (!neighborColors.has(palette[i])) {
          chosenColor = palette[i];
          break;
        }
      }
      colors.set(node.id, chosenColor);
    });

    return colors;
  }, [data, settings.colorMode]);

  const getVisualLength = (bp: number) => {
    return 20 + Math.pow(bp, 0.4) * settings.nodeLengthScale * 20;
  };

  const getNodeColor = (node: AssemblyNode) => {
    if (settings.colorMode === ColorMode.DEPTH) {
      return d3.interpolateSpectral(Math.min(1, Math.max(0, 1 - (node.coverage / 100))));
    } else if (settings.colorMode === ColorMode.LENGTH) {
      return d3.interpolateViridis(Math.min(1, node.length / 50000));
    } else if (settings.colorMode === ColorMode.RANDOM) {
      return randomColorMap.get(node.id) || '#ccc';
    } else {
      return '#60a5fa'; 
    }
  };

  const getLabelText = (node: AssemblyNode) => {
    const parts: string[] = [];
    if (settings.labelContent.custom) parts.push("Custom");
    if (settings.labelContent.name) parts.push(node.id);
    if (settings.labelContent.length) parts.push(formatBasePairs(node.length));
    if (settings.labelContent.depth) parts.push(formatCoverage(node.coverage));
    if (settings.labelContent.blast) parts.push("No hits");
    if (settings.labelContent.csv && settings.csvLabels[node.id]) {
      parts.push(settings.csvLabels[node.id]);
    }
    return parts.join('; ');
  };

  // Zoom Control Handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.8);
    }
  };

  const handleResetView = () => {
    if (svgRef.current && zoomRef.current) {
       d3.select(svgRef.current).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Freeze Physics when Brush Mode is active
  useEffect(() => {
    if (simulationRef.current) {
      if (isBrushMode) {
        simulationRef.current.stop();
      } else {
        simulationRef.current.alpha(0.1).restart();
      }
    }
  }, [isBrushMode]);

  // Main Effect: Setup Simulation and Rendering
  useEffect(() => {
    if (!svgRef.current) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Prepare Data
    nodeLookup.current.clear();
    const simNodes: SimulationNode[] = [];
    const simLinks: SimulationLink[] = [];

    data.nodes.forEach(node => {
      nodeLookup.current.set(node.id, node);
      const length = getVisualLength(node.length);
      const angle = Math.random() * Math.PI * 2;
      const cx = width / 2 + (Math.random() - 0.5) * 200;
      const cy = height / 2 + (Math.random() - 0.5) * 200;

      const startNode: SimulationNode = {
        id: `${node.id}_start`,
        parentId: node.id,
        type: 'start',
        x: cx - (Math.cos(angle) * length) / 2,
        y: cy - (Math.sin(angle) * length) / 2,
        r: settings.nodeWidthScale
      };

      const endNode: SimulationNode = {
        id: `${node.id}_end`,
        parentId: node.id,
        type: 'end',
        x: cx + (Math.cos(angle) * length) / 2,
        y: cy + (Math.sin(angle) * length) / 2,
        r: settings.nodeWidthScale
      };

      simNodes.push(startNode, endNode);

      simLinks.push({
        id: `${node.id}_backbone`,
        source: startNode.id,
        target: endNode.id,
        type: 'backbone',
        parentId: node.id
      });
    });

    data.links.forEach((link, i) => {
      simLinks.push({
        id: `edge_${i}`,
        source: `${link.source}_end`,
        target: `${link.target}_start`,
        type: 'edge'
      });
    });

    // 2. Setup D3
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    // Background handler for clearing selection
    svg.on("click", (event) => {
      if (event.target.tagName === 'svg' && !isBrushMode) {
        onSelectionChange([]);
      }
    });

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow-head")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#64748b")
      .attr("d", "M0,-5L10,0L0,5");

    // Selection Glow Filter
    const filter = defs.append("filter")
      .attr("id", "selection-glow")
      .attr("height", "300%")
      .attr("width", "300%")
      .attr("x", "-100%")
      .attr("y", "-100%");
    filter.append("feMorphology").attr("operator", "dilate").attr("radius", "3").attr("in", "SourceAlpha").attr("result", "thicken");
    filter.append("feGaussianBlur").attr("in", "thicken").attr("stdDeviation", "3").attr("result", "blurred");
    filter.append("feFlood").attr("flood-color", "white").attr("result", "glowColor");
    filter.append("feComposite").attr("in", "glowColor").attr("in2", "blurred").attr("operator", "in").attr("result", "softGlow");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "softGlow");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Container Group for Zooming
    const container = svg.append("g").attr("class", "zoom-container");

    // Zoom Behavior - Filter out brush events
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        // Disable zoom if in brush mode or right click
        if (isBrushMode) return false;
        return !event.button || event.button === 0; // Only left click or touch
      })
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
        setTransform(event.transform);
      });
    
    zoomRef.current = zoom;

    // Apply zoom behavior to SVG
    svg.call(zoom);
    // Restore zoom
    if (transform.k !== 1 || transform.x !== 0 || transform.y !== 0) {
       svg.call(zoom.transform, transform);
    }

    // 3. Simulation Forces
    const simulation = d3.forceSimulation<SimulationNode, SimulationLink>(simNodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(simLinks)
        .id(d => d.id)
        .distance(d => {
           if (d.type === 'backbone' && d.parentId) {
             const node = nodeLookup.current.get(d.parentId);
             return node ? getVisualLength(node.length) : 20;
           }
           return settings.linkDistance;
        })
        .strength(d => d.type === 'backbone' ? 1 : 0.5)
      )
      .force("charge", d3.forceManyBody().strength(settings.chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(settings.nodeWidthScale * 1.5).iterations(2));

    simulationRef.current = simulation;
    
    // Force simulation stop if initialized in brush mode
    if (isBrushMode) simulation.stop();

    // 4. Rendering Groups
    const linkGroup = container.append("g").attr("class", "links");
    const nodeGroup = container.append("g").attr("class", "nodes");
    const labelGroup = container.append("g").attr("class", "labels");

    // Define graph updating function
    const updateGraph = () => {
      const edges = linkGroup.selectAll<SVGPathElement, SimulationLink>("path.edge")
        .data(simLinks.filter(l => l.type === 'edge'))
        .join("path")
        .attr("class", "edge")
        .attr("fill", "none")
        .attr("stroke", "#475569")
        .attr("stroke-width", 2)
        .attr("marker-end", settings.showArrows ? "url(#arrow-head)" : null);

      const contigs = nodeGroup.selectAll<SVGPathElement, AssemblyNode>("path.contig")
        .data(data.nodes)
        .join("path")
        .attr("class", "contig")
        .attr("id", d => `node-${d.id}`)
        .attr("stroke-width", settings.nodeWidthScale)
        .attr("stroke", d => getNodeColor(d))
        .attr("stroke-linecap", "round")
        .attr("fill", "none")
        .attr("cursor", isBrushMode ? "crosshair" : "pointer")
        .on("click", (e, d) => {
          if (!isBrushMode) {
            e.stopPropagation();
            onSelectionChange([d]);
          }
        });

      const labels = labelGroup.selectAll<SVGTextElement, AssemblyNode>("text")
        .data(data.nodes)
        .join("text")
        .text(d => getLabelText(d))
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", "10px")
        .attr("fill", "white")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("pointer-events", "none")
        .style("opacity", settings.showLabels ? 1 : 0);

      if (settings.labelOutline) {
          labels.attr("stroke", "black").attr("stroke-width", 2).attr("paint-order", "stroke");
      } else {
          labels.attr("stroke", "none").style("text-shadow", "0px 1px 2px rgba(0,0,0,0.8)");
      }

      simulation.on("tick", () => {
        edges.attr("d", d => {
          const s = d.source as SimulationNode;
          const t = d.target as SimulationNode;
          if (s.x !== undefined && s.y !== undefined && t.x !== undefined && t.y !== undefined) {
             return `M${s.x},${s.y} L${t.x},${t.y}`;
          }
          return "";
        });

        contigs.attr("d", d => {
          const s = simNodes.find(n => n.id === `${d.id}_start`);
          const e = simNodes.find(n => n.id === `${d.id}_end`);
          if (s && e && s.x !== undefined && s.y !== undefined && e.x !== undefined && e.y !== undefined) {
             return `M${s.x},${s.y} L${e.x},${e.y}`;
          }
          return "";
        });

        labels.attr("transform", d => {
          const s = simNodes.find(n => n.id === `${d.id}_start`);
          const e = simNodes.find(n => n.id === `${d.id}_end`);
          if (s && e && s.x !== undefined && e.x !== undefined) {
            const mx = (s.x + e.x) / 2;
            const my = (s.y + (e.y || 0)) / 2;
            return `translate(${mx}, ${my})`;
          }
          return "translate(0,0)";
        });
      });
    };

    updateGraph();
    
    // Drag behavior (only active if NOT in brush mode)
    const drag = d3.drag<SVGPathElement, AssemblyNode>()
      .filter(() => !isBrushMode)
      .on("start", (e, d) => {
        if (!e.active) simulation.alphaTarget(0.3).restart();
        const s = simNodes.find(n => n.id === `${d.id}_start`);
        const end = simNodes.find(n => n.id === `${d.id}_end`);
        if (s && end) {
          s.fx = s.x; s.fy = s.y;
          end.fx = end.x; end.fy = end.y;
        }
      })
      .on("drag", (e, d) => {
        const s = simNodes.find(n => n.id === `${d.id}_start`);
        const end = simNodes.find(n => n.id === `${d.id}_end`);
        if (s && end && s.fx !== null && s.fy !== null && end.fx !== null && end.fy !== null) {
          s.fx += e.dx;
          s.fy += e.dy;
          end.fx += e.dx;
          end.fy += e.dy;
        }
      })
      .on("end", (e, d) => {
        if (!e.active) simulation.alphaTarget(0);
        const s = simNodes.find(n => n.id === `${d.id}_start`);
        const end = simNodes.find(n => n.id === `${d.id}_end`);
        if (s && end) {
          s.fx = null; s.fy = null;
          end.fx = null; end.fy = null;
        }
      });

    nodeGroup.selectAll("path.contig").call(drag as any);

    return () => {
      simulation.stop();
    };
  }, [data, settings.linkDistance, settings.chargeStrength, settings.nodeLengthScale, settings.nodeWidthScale, settings.showArrows, settings.showLabels, settings.colorMode, settings.labelContent, settings.labelOutline, settings.csvLabels, randomColorMap, isBrushMode]); 

  // Separate Effect: Selection Highlight (Multiple Nodes)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const contigs = svg.selectAll<SVGPathElement, AssemblyNode>("path.contig");
    
    const isSelected = (id: string) => selectedNodes.some(n => n.id === id);
    const hasSelection = selectedNodes.length > 0;

    contigs.transition().duration(200)
      .style("opacity", d => hasSelection && !isSelected(d.id) ? 0.3 : 1)
      .style("filter", d => isSelected(d.id) ? "url(#selection-glow)" : null);
      
    if (hasSelection) {
      selectedNodes.forEach(node => {
        contigs.filter(d => d.id === node.id).raise();
      });
    }
  }, [selectedNodes, data, settings]);

  // Separate Effect: Brush Logic
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    svg.select(".brush-group").remove();

    if (isBrushMode) {
      const brush = d3.brush()
        .extent([[0, 0], [window.innerWidth, window.innerHeight]])
        .on("end", (event) => {
           if (!event.selection) return;
           const [[x0, y0], [x1, y1]] = event.selection;
           
           const simNodes = simulationRef.current?.nodes() || [];
           const newSelected: AssemblyNode[] = [];

           data.nodes.forEach(node => {
             const s = simNodes.find(n => n.id === `${node.id}_start`);
             const e = simNodes.find(n => n.id === `${node.id}_end`);
             
             if (s && e && s.x != null && s.y != null && e.x != null && e.y != null) {
               const startIn = s.x * transform.k + transform.x >= x0 && s.x * transform.k + transform.x <= x1 && 
                               s.y * transform.k + transform.y >= y0 && s.y * transform.k + transform.y <= y1;
               
               const endIn = e.x * transform.k + transform.x >= x0 && e.x * transform.k + transform.x <= x1 && 
                             e.y * transform.k + transform.y >= y0 && e.y * transform.k + transform.y <= y1;

               if (startIn || endIn) {
                 newSelected.push(node);
               }
             }
           });
           
           onSelectionChange(newSelected);
           brushGroup.call(brush.move, null);
        });

      const brushGroup = svg.append("g")
        .attr("class", "brush-group")
        .call(brush);
    }
  }, [isBrushMode, data, transform, onSelectionChange]);

  return (
    <div className="relative w-full h-full bg-canvas overflow-hidden">
      <svg
        ref={svgRef}
        className={`w-full h-full block touch-none ${isBrushMode ? 'cursor-crosshair' : ''}`}
        width="100%"
        height="100%"
      >
        <defs></defs>
        {/* Content injected by D3 */}
      </svg>

      {/* Physical Zoom Controls Overlay */}
      <div className="absolute top-20 left-4 flex flex-col gap-2 z-10 print:hidden">
        <button 
          onClick={handleZoomIn}
          className="p-2 bg-slate-800/80 backdrop-blur text-slate-200 rounded-lg shadow-lg hover:bg-slate-700 border border-slate-600/50 transition-all active:scale-95"
          title="Zoom In"
        >
          <Plus size={20} />
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-2 bg-slate-800/80 backdrop-blur text-slate-200 rounded-lg shadow-lg hover:bg-slate-700 border border-slate-600/50 transition-all active:scale-95"
          title="Zoom Out"
        >
          <Minus size={20} />
        </button>
        <button 
          onClick={handleResetView}
          className="p-2 bg-slate-800/80 backdrop-blur text-slate-200 rounded-lg shadow-lg hover:bg-slate-700 border border-slate-600/50 transition-all active:scale-95"
          title="Reset View"
        >
          <Maximize size={20} />
        </button>
      </div>
    </div>
  );
};

export default GraphVisualizer;