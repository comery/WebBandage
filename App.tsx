import React, { useState, useCallback } from 'react';
import GraphVisualizer from './components/GraphVisualizer';
import ControlPanel from './components/ControlPanel';
import { GraphData, GraphSettings, DEFAULT_SETTINGS, AssemblyNode } from './types';
import { generateMockAssemblyGraph } from './services/graphGenerator';
import { parseGFAAsync } from './services/gfaParser';
import { Download, Menu, X, FileText, Image, MousePointer2, BoxSelect } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<GraphData>(() => generateMockAssemblyGraph(40));
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Selection State
  const [selectedNodes, setSelectedNodes] = useState<AssemblyNode[]>([]);
  const [isBrushMode, setIsBrushMode] = useState(false);
  
  // Parsing State
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState(0);
  const [uploadedGfaContent, setUploadedGfaContent] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [searchSummary, setSearchSummary] = useState<{ total: number; found: number; notFound: string[] } | null>(null);

  React.useEffect(() => {
    const color = settings.lightBackground ? '#ffffff' : '#0f172a';
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
  }, [settings.lightBackground]);

  const regenerateGraph = useCallback(() => {
    setData(generateMockAssemblyGraph(Math.floor(Math.random() * 30) + 20));
    setSelectedNodes([]);
  }, []);

  const demoFilesMap = import.meta.glob('./demo_graph/*.gfa', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
  const demoFiles = Object.keys(demoFilesMap).map(p => ({ path: p, name: p.split('/').pop() || p }));
  const [selectedDemoPath, setSelectedDemoPath] = useState<string>('./demo_graph/graph.gfa');

  const handleGFAUploadContent = useCallback((content: string) => {
    setUploadedGfaContent(content);
    setParsingProgress(0);
    setIsParsing(false);
  }, []);

  const handleStartDraw = useCallback(async () => {
    if (!uploadedGfaContent) return;
    try {
      const controller = new AbortController();
      setAbortController(controller);
      setIsParsing(true);
      setParsingProgress(0);
      const newData = await parseGFAAsync(uploadedGfaContent, (done, total) => {
        setParsingProgress(total ? done / total : 0);
      }, controller.signal);
      setData(newData);
      setSelectedNodes([]);
      setParsingProgress(1);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error("Failed to parse GFA", e);
        alert("Failed to parse GFA file. Please check the format.");
      }
    } finally {
      setIsParsing(false);
      setAbortController(null);

    }
  }, [uploadedGfaContent]);

  const handleLoadSelectedDemo = useCallback(async () => {
    const content = demoFilesMap[selectedDemoPath];
    if (!content) return;
    try {
      const controller = new AbortController();
      setAbortController(controller);
      setIsParsing(true);
      setParsingProgress(0);
      const newData = await parseGFAAsync(content, (done, total) => {
        setParsingProgress(total ? done / total : 0);
      }, controller.signal);
      setData(newData);
      setSelectedNodes([]);
      setParsingProgress(1);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Failed to load demo GFA', e);
        alert('Failed to load demo GFA.');
      }
    } finally {
      setIsParsing(false);
      setAbortController(null);
    }
  }, [selectedDemoPath]);

  const handleCancelDraw = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const handleSearchIds = useCallback((input: string) => {
    const parts = input
      .split(/[;,\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(parts));
    const set = new Set(unique);
    const foundNodes = data.nodes.filter(n => set.has(n.id));
    const foundIds = new Set(foundNodes.map(n => n.id));
    const notFound = unique.filter(id => !foundIds.has(id));
    setSelectedNodes(foundNodes);
    setSearchSummary({ total: unique.length, found: foundNodes.length, notFound });
  }, [data]);

  const handleExportSvg = () => {
    const svgElement = document.getElementById('main-graph-svg');
    if (!svgElement) {
      console.error("SVG element not found");
      return;
    }
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    
    // Inject a background rectangle so it's not transparent
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", settings.lightBackground ? "#ffffff" : "#0f172a");
    // Insert as first child
    if (clone.firstChild) {
      clone.insertBefore(bgRect, clone.firstChild);
    } else {
      clone.appendChild(bgRect);
    }

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bandage_graph.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    const svgElement = document.querySelector<SVGSVGElement>('#main-graph-svg');
    if (!svgElement) return;
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', '#ffffff');
    clone.insertBefore(bgRect, clone.firstChild);
    const svgString = new XMLSerializer().serializeToString(clone);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page{size:landscape;margin:0}body{margin:0;-webkit-print-color-adjust:exact}svg{width:100vw;height:100vh;display:block}</style></head><body>${svgString}</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 200);
  };

  return (
    <div className={`relative w-screen h-screen overflow-hidden font-sans print:overflow-visible print:bg-white print:h-auto ${settings.lightBackground ? 'bg-white text-slate-900' : 'bg-canvas text-white'}`}>
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-semibold text-slate-200">Processing Graph Data...</h2>
          <p className="text-slate-400 text-sm mt-2">Parsing nodes and links</p>
        </div>
      )}

      {/* Top Navigation / Tools Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none print:hidden">
        <div className="pointer-events-auto flex gap-2">
           <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             className="p-2.5 bg-panel/90 backdrop-blur-sm border border-slate-600/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95"
           >
             {isSidebarOpen ? <X size={20}/> : <Menu size={20} />}
           </button>

           {/* Mode Toggle: Freeze & Select */}
           <div className="flex items-center bg-panel/90 backdrop-blur-sm border border-slate-600/50 rounded-lg overflow-hidden shadow-xl">
              <button 
                onClick={() => setIsBrushMode(false)}
                className={`flex items-center gap-2 px-3 py-2 transition-colors ${!isBrushMode ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-700'}`}
                title="Move: Pan and Zoom the graph"
              >
                <MousePointer2 size={16} />
                <span className="hidden sm:inline text-xs">Move</span>
              </button>
              <div className="w-px h-full bg-slate-600/50"></div>
              <button 
                onClick={() => setIsBrushMode(true)}
                className={`flex items-center gap-2 px-3 py-2 transition-colors ${isBrushMode ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-700'}`}
                title="Freeze: Lock view and Drag Select"
              >
                <BoxSelect size={16} />
                <span className="hidden sm:inline text-xs">Freeze & Select</span>
              </button>
           </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button 
            onClick={handleExportSvg}
            title="Export Vector SVG"
            className="flex items-center gap-2 px-4 py-2 bg-panel/90 backdrop-blur-sm border border-slate-600/50 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            <Image size={16} />
            <span className="hidden sm:inline">SVG</span>
          </button>
          <button 
            onClick={handleExportPdf}
            title="Print to PDF"
            className="flex items-center gap-2 px-4 py-2 bg-panel/90 backdrop-blur-sm border border-slate-600/50 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            <FileText size={16} />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="print:hidden">
        <ControlPanel 
          settings={settings}
          onSettingsChange={setSettings}
          onRegenerate={regenerateGraph}
          onUploadGFA={handleGFAUploadContent}
          onStartDraw={handleStartDraw}
          onCancelDraw={handleCancelDraw}
          onSearchIds={handleSearchIds}
          isOpen={isSidebarOpen}
          toggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
          selectedNodes={selectedNodes}
      hasUploaded={!!uploadedGfaContent}
          isParsing={isParsing}
          parsingProgress={parsingProgress}
          demoFiles={demoFiles}
          selectedDemoPath={selectedDemoPath}
          onSelectDemoPath={setSelectedDemoPath}
          onLoadSelectedDemo={handleLoadSelectedDemo}
          searchSummary={searchSummary}
        />
      </div>

      {/* Main Canvas Area */}
      <div 
        className={`w-full h-full transition-all duration-300 ease-in-out ${isSidebarOpen ? 'pl-80' : 'pl-0'} print:pl-0 print:h-auto print:overflow-visible`}
      >
        <GraphVisualizer 
          data={data} 
          settings={settings} 
          onSelectionChange={setSelectedNodes}
          selectedNodes={selectedNodes}
          isBrushMode={isBrushMode}
          onToggleBrushMode={() => setIsBrushMode(!isBrushMode)}
        />
      </div>

      {/* Print Specific Styles */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          body, html { 
              visibility: visible !important; 
              overflow: visible !important; 
              height: 100% !important; 
              width: 100% !important;
              background: white !important;
          }
          .bg-canvas { 
              background-color: white !important; 
              position: relative !important;
              height: auto !important;
              width: 100% !important;
              overflow: visible !important;
          }
          text { fill: black !important; text-shadow: none !important; }
          path.contig { stroke-opacity: 0.8 !important; }
          path.edge { stroke: #000 !important; }
          /* Ensure SVG is visible and scales to page */
          svg { 
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important; 
              height: 100% !important; 
              overflow: visible !important;
              display: block !important;
          }
          /* Hide UI */
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
