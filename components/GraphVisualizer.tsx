import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphSettings, AssemblyNode, AssemblyLink, ColorMode, SimulationNode, SimulationLink } from '../types';
import { formatBasePairs, formatCoverage } from '../services/graphGenerator';
import { Plus, Minus, Maximize, BoxSelect, MousePointer2 } from 'lucide-react';

interface GraphVisualizerProps {
  data: GraphData;
  settings: GraphSettings;
  onSelectionChange: (nodes: AssemblyNode[]) => void;
  selectedNodes: AssemblyNode[];
  isBrushMode: boolean;
  onToggleBrushMode?: () => void;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ 
  data, 
  settings, 
  onSelectionChange, 
  selectedNodes,
  isBrushMode,
  onToggleBrushMode
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Refs to store simulation state to prevent re-initialization on simple prop changes
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const simNodesRef = useRef<SimulationNode[]>([]);
  const simLinksRef = useRef<SimulationLink[]>([]);
  const nodeLookup = useRef<Map<string, AssemblyNode>>(new Map());
  
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const filteredData = useMemo<GraphData>(() => {
    const t = settings.minNodesToRender ?? 0;
    if (!t || t <= 0) return data;
    const adj = new Map<string, Set<string>>();
    data.nodes.forEach(n => adj.set(n.id, new Set()));
    data.links.forEach(l => {
      adj.get(l.source)?.add(l.target);
      adj.get(l.target)?.add(l.source);
    });
    const visited = new Set<string>();
    const keep = new Set<string>();
    for (const n of data.nodes) {
      if (visited.has(n.id)) continue;
      const queue: string[] = [n.id];
      const comp: string[] = [];
      visited.add(n.id);
      while (queue.length) {
        const u = queue.pop() as string;
        comp.push(u);
        const neighbors = adj.get(u) || new Set<string>();
        neighbors.forEach(v => {
          if (!visited.has(v)) { visited.add(v); queue.push(v); }
        });
      }
      if (comp.length >= t) comp.forEach(id => keep.add(id));
    }
    const nodes = data.nodes.filter(n => keep.has(n.id));
    const links = data.links.filter(l => keep.has(l.source) && keep.has(l.target));
    return { nodes, links };
  }, [data, settings.minNodesToRender]);
  const hiddenByMinNodes = (settings.minNodesToRender ?? 0) > 0 && filteredData.nodes.length === 0;

  // Compute colors for RANDOM mode
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

  // Zoom Controls
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

  // 1. Initialize Simulation Logic (Run only when data changes, NOT when isBrushMode changes)
  useEffect(() => {
    if (!svgRef.current) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (hiddenByMinNodes) {
      simulationRef.current?.stop();
      d3.select(svgRef.current).selectAll('*').remove();
      return () => {};
    }

    // Prepare Data
    nodeLookup.current.clear();
    const newSimNodes: SimulationNode[] = [];
    const newSimLinks: SimulationLink[] = [];

    filteredData.nodes.forEach(node => {
      nodeLookup.current.set(node.id, node);
      const length = getVisualLength(node.length);
      const angle = Math.random() * Math.PI * 2;
      const cx = width / 2 + (Math.random() - 0.5) * 200;
      const cy = height / 2 + (Math.random() - 0.5) * 200;

      // Check if we have existing positions to preserve
      const existingStart = simNodesRef.current.find(n => n.id === `${node.id}_start`);
      const existingEnd = simNodesRef.current.find(n => n.id === `${node.id}_end`);

      const startNode: SimulationNode = {
        id: `${node.id}_start`,
        parentId: node.id,
        type: 'start',
        x: existingStart?.x ?? cx - (Math.cos(angle) * length) / 2,
        y: existingStart?.y ?? cy - (Math.sin(angle) * length) / 2,
        r: settings.nodeWidthScale
      };

      const endNode: SimulationNode = {
        id: `${node.id}_end`,
        parentId: node.id,
        type: 'end',
        x: existingEnd?.x ?? cx + (Math.cos(angle) * length) / 2,
        y: existingEnd?.y ?? cy + (Math.sin(angle) * length) / 2,
        r: settings.nodeWidthScale
      };

      newSimNodes.push(startNode, endNode);

      newSimLinks.push({
        id: `${node.id}_backbone`,
        source: startNode.id,
        target: endNode.id,
        type: 'backbone',
        parentId: node.id
      });
    });

    filteredData.links.forEach((link, i) => {
      newSimLinks.push({
        id: `edge_${i}`,
        source: `${link.source}_end`,
        target: `${link.target}_start`,
        type: 'edge'
      });
    });

    simNodesRef.current = newSimNodes;
    simLinksRef.current = newSimLinks;

    // Create Simulation
    const simulation = d3.forceSimulation<SimulationNode, SimulationLink>(newSimNodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(newSimLinks)
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

    return () => {
      simulation.stop();
    };
  }, [filteredData, data, settings.linkDistance, settings.chargeStrength, settings.nodeLengthScale, settings.nodeWidthScale, settings.minNodesToRender]);

  // 2. Handle Simulation Parameters Updates (Update Forces without resetting)
  useEffect(() => {
     const simulation = simulationRef.current;
     if (!simulation) return;

     simulation.force("charge", d3.forceManyBody().strength(settings.chargeStrength));
     simulation.force("collide", d3.forceCollide().radius(settings.nodeWidthScale * 1.5).iterations(2));
     
     const linkForce = simulation.force("link") as d3.ForceLink<SimulationNode, SimulationLink>;
     if (linkForce) {
        linkForce.distance(d => {
           if (d.type === 'backbone' && d.parentId) {
             const node = nodeLookup.current.get(d.parentId);
             return node ? getVisualLength(node.length) : 20;
           }
           return settings.linkDistance;
        });
     }

     if (!isBrushMode) {
        simulation.alpha(0.3).restart();
     }
  }, [settings]);


  // 3. Freeze Logic (Toggle Brush Mode)
  useEffect(() => {
    if (simulationRef.current) {
      if (isBrushMode) {
        simulationRef.current.stop();
      } else {
        simulationRef.current.alpha(0.1).restart();
      }
    }
  }, [isBrushMode]);


  // 4. Rendering (Updates DOM)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const simulation = simulationRef.current;
    if (hiddenByMinNodes) {
      simulation?.stop();
      simNodesRef.current = [];
      simLinksRef.current = [];
      svg.selectAll('*').remove();
      return;
    }
    
    if (!simulation) return;

    // Setup container only once or if missing
    let container = svg.select("g.zoom-container") as d3.Selection<SVGGElement, unknown, null, unknown>;
    if (container.empty()) {
       svg.selectAll("*").remove();
       
        // Background handler
        svg.on("click", (event: any) => {
          const target = event?.target as Element | null;
          if (target && target.tagName === 'svg' && !isBrushMode) {
            onSelectionChange([]);
          }
        });

        const defs = svg.select('defs').empty() ? svg.append("defs") : svg.select('defs');
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

        // Selection Glow
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

        container = svg.append("g").attr("class", "zoom-container");
        
        // Groups
        container.append("g").attr("class", "links");
        container.append("g").attr("class", "nodes");
        container.append("g").attr("class", "labels");

        // Zoom Setup
        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.1, 5])
          .on("zoom", (event) => {
            container.attr("transform", event.transform);
            setTransform(event.transform);
          });
        zoomRef.current = zoom;
        svg.call(zoom);
    }

    // Update Zoom Filter dynamically based on isBrushMode
    if (zoomRef.current) {
        zoomRef.current.filter((event: any) => {
            if (isBrushMode) return false;
            const btn = event?.button;
            return btn == null || btn === 0;
        });
    }

    // Render Elements
    const linkGroup = container.select("g.links");
    const nodeGroup = container.select("g.nodes");
    const labelGroup = container.select("g.labels");

    const updateVisuals = () => {
      const edges = linkGroup.selectAll<SVGPathElement, SimulationLink>("path.edge")
        .data(simLinksRef.current.filter(l => l.type === 'edge'), d => (d as any).id)
        .join("path")
        .attr("class", "edge")
        .attr("fill", "none")
        .attr("stroke", "#475569")
        .attr("stroke-width", 2)
        .attr("marker-end", settings.showArrows ? "url(#arrow-head)" : null);

      const contigs = nodeGroup.selectAll<SVGPathElement, AssemblyNode>("path.contig")
        .data(filteredData.nodes, d => (d as any).id)
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
        .data(filteredData.nodes, d => (d as any).id)
        .join("text")
        .text(d => getLabelText(d))
        .attr("font-family", "JetBrains Mono")
        .attr("font-size", "10px")
        .attr("fill", settings.lightBackground ? "#111" : "white")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("pointer-events", "none")
        .style("opacity", settings.showLabels ? 1 : 0);

      if (settings.labelOutline) {
          labels
            .attr("stroke", settings.lightBackground ? "#ffffff" : "#000000")
            .attr("stroke-width", settings.lightBackground ? 3 : 2)
            .attr("paint-order", "stroke")
            .style("text-shadow", "none");
      } else {
          labels
            .attr("stroke", "none")
            .style("text-shadow", settings.lightBackground ? "0px 1px 1px rgba(0,0,0,0.2)" : "0px 1px 2px rgba(0,0,0,0.8)");
      }

      let lastTick = 0;
      simulation.on("tick", () => {
        const now = performance.now();
        if (now - lastTick < 16) return;
        lastTick = now;

        edges.attr("d", d => {
          const s = d.source as SimulationNode;
          const t = d.target as SimulationNode;
          if (s.x !== undefined && s.y !== undefined && t.x !== undefined && t.y !== undefined) {
             return `M${s.x},${s.y} L${t.x},${t.y}`;
          }
          return "";
        });

        contigs.attr("d", d => {
          const s = simNodesRef.current.find(n => n.id === `${d.id}_start`);
          const e = simNodesRef.current.find(n => n.id === `${d.id}_end`);
          if (s && e && s.x !== undefined && s.y !== undefined && e.x !== undefined && e.y !== undefined) {
             return `M${s.x},${s.y} L${e.x},${e.y}`;
          }
          return "";
        });

        labels.attr("transform", d => {
          const s = simNodesRef.current.find(n => n.id === `${d.id}_start`);
          const e = simNodesRef.current.find(n => n.id === `${d.id}_end`);
          if (s && e && s.x !== undefined && e.x !== undefined) {
            const mx = (s.x + e.x) / 2;
            const my = (s.y + (e.y || 0)) / 2;
            return `translate(${mx}, ${my})`;
          }
          return "translate(0,0)";
        });
      });
    };

    updateVisuals();

    // Drag Behavior
    const drag = d3.drag<SVGPathElement, AssemblyNode>()
      .filter(() => !isBrushMode)
      .on("start", (e, d) => {
        if (!e.active) simulation.alphaTarget(0.3).restart();
        const s = simNodesRef.current.find(n => n.id === `${d.id}_start`);
        const end = simNodesRef.current.find(n => n.id === `${d.id}_end`);
        if (s && end) {
          s.fx = s.x; s.fy = s.y;
          end.fx = end.x; end.fy = end.y;
        }
      })
      .on("drag", (e, d) => {
        const s = simNodesRef.current.find(n => n.id === `${d.id}_start`);
        const end = simNodesRef.current.find(n => n.id === `${d.id}_end`);
        if (s && end && s.fx !== null && s.fy !== null && end.fx !== null && end.fy !== null) {
          s.fx += e.dx;
          s.fy += e.dy;
          end.fx += e.dx;
          end.fy += e.dy;
        }
      })
      .on("end", (e, d) => {
        if (!e.active) simulation.alphaTarget(0);
        const s = simNodesRef.current.find(n => n.id === `${d.id}_start`);
        const end = simNodesRef.current.find(n => n.id === `${d.id}_end`);
        if (s && end) {
          s.fx = null; s.fy = null;
          end.fx = null; end.fy = null;
        }
      });
      
    nodeGroup.selectAll("path.contig").call(drag as any);

  }, [filteredData, data, settings, isBrushMode, randomColorMap]); 
  // isBrushMode here triggers re-render (cursor, drag filter), 
  // but because Simulation Initialization logic is in a separate useEffect that DOES NOT depend on isBrushMode, 
  // positions are preserved.

  // Separate Effect: Selection Highlight
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
  }, [selectedNodes, filteredData, settings]);

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
           
           const simNodes = simNodesRef.current;
           const newSelected: AssemblyNode[] = [];

           filteredData.nodes.forEach(node => {
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
  }, [isBrushMode, filteredData, transform, onSelectionChange]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.select('.selection-drag-layer').remove();
    if (!(isBrushMode && selectedNodes.length > 0)) return;

    const dragLayer = svg.append('rect')
      .attr('class', 'selection-drag-layer')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', '100%')
      .attr('height', '100%')
      .style('fill', 'none')
      .style('pointer-events', 'all');

    const drag = d3.drag<SVGRectElement, unknown>()
      .on('drag', (e) => {
        const dx = e.dx / transform.k;
        const dy = e.dy / transform.k;
        selectedNodes.forEach(node => {
          const s = simNodesRef.current.find(n => n.id === `${node.id}_start`);
          const end = simNodesRef.current.find(n => n.id === `${node.id}_end`);
          if (s && end) {
            if (s.x != null) s.x += dx; if (s.y != null) s.y += dy;
            if (end.x != null) end.x += dx; if (end.y != null) end.y += dy;
            if (s.fx != null) s.fx += dx; if (s.fy != null) s.fy += dy;
            if (end.fx != null) end.fx += dx; if (end.fy != null) end.fy += dy;
          }
        });

        const container = svg.select('g.zoom-container');
        const linkGroup = container.select('g.links');
        const nodeGroup = container.select('g.nodes');
        const labelGroup = container.select('g.labels');

        linkGroup.selectAll<SVGPathElement, SimulationLink>('path.edge')
          .attr('d', d => {
            const s = d.source as SimulationNode;
            const t = d.target as SimulationNode;
            if (s.x !== undefined && s.y !== undefined && t.x !== undefined && t.y !== undefined) {
               return `M${s.x},${s.y} L${t.x},${t.y}`;
            }
            return '';
          });

        nodeGroup.selectAll<SVGPathElement, AssemblyNode>('path.contig')
          .attr('d', d => {
            const s = simNodesRef.current.find(n => n.id === `${d.id}_start`);
            const e2 = simNodesRef.current.find(n => n.id === `${d.id}_end`);
            if (s && e2 && s.x !== undefined && s.y !== undefined && e2.x !== undefined && e2.y !== undefined) {
               return `M${s.x},${s.y} L${e2.x},${e2.y}`;
            }
            return '';
          });

        labelGroup.selectAll<SVGTextElement, AssemblyNode>('text')
          .attr('transform', d => {
            const s = simNodesRef.current.find(n => n.id === `${d.id}_start`);
            const e2 = simNodesRef.current.find(n => n.id === `${d.id}_end`);
            if (s && e2 && s.x !== undefined && e2.x !== undefined) {
              const mx = (s.x + e2.x) / 2;
              const my = (s.y + (e2.y || 0)) / 2;
              return `translate(${mx}, ${my})`;
            }
            return 'translate(0,0)';
          });
      });

    dragLayer.call(drag as any);
  }, [isBrushMode, selectedNodes, transform]);

  return (
    <div className={`relative w-full h-full overflow-hidden print:overflow-visible ${settings.lightBackground ? 'bg-white' : 'bg-canvas'}`}>
      <svg
        id="main-graph-svg"
        ref={svgRef}
        className={`w-full h-full block touch-none ${isBrushMode ? 'cursor-crosshair' : ''}`}
        width="100%"
        height="100%"
      >
        <defs></defs>
      </svg>

      {hiddenByMinNodes && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm print:hidden">
          Graph hidden: fewer than minimum nodes
        </div>
      )}

      {/* Physical Zoom Controls Overlay + Freeze Button */}
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

        {/* Separator */}
        <div className="w-full h-px bg-slate-600/50 my-1" />

        {/* Freeze/Select Toggle */}
        <button
          onClick={onToggleBrushMode}
          className={`p-2 backdrop-blur rounded-lg shadow-lg border transition-all active:scale-95 ${
            isBrushMode
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-slate-800/80 text-slate-200 border-slate-600/50 hover:bg-slate-700'
          }`}
          title={isBrushMode ? "Switch to Move Mode" : "Freeze & Select Area"}
        >
          {isBrushMode ? <MousePointer2 size={20} /> : <BoxSelect size={20} />}
        </button>
      </div>
    </div>
  );
};

export default GraphVisualizer;
