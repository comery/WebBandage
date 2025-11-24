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
  
  // Selection State
  const [selectedNodes, setSelectedNodes] = useState<AssemblyNode[]>([]);
  const [isBrushMode, setIsBrushMode] = useState(false);
  
  // Parsing State
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState(0);
  const [uploadedGfaContent, setUploadedGfaContent] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const regenerateGraph = useCallback(() => {
    setData(generateMockAssemblyGraph(Math.floor(Math.random() * 30) + 20));
    setSelectedNodes([]);
  }, []);

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

  const handleCancelDraw = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const handleExportSvg = () => {
    const svgElement = document.querySelector('svg');
    if (!svgElement) return;
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
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
    window.print();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-canvas text-white font-sans print:bg-white">
      
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
          isOpen={isSidebarOpen}
          toggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
          selectedNodes={selectedNodes}
          hasUploaded={!!uploadedGfaContent}
          isParsing={isParsing}
          parsingProgress={parsingProgress}
        />
      </div>

      {/* Main Canvas Area */}
      <div 
        className={`w-full h-full transition-all duration-300 ease-in-out ${isSidebarOpen ? 'pl-80' : 'pl-0'} print:pl-0`}
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
          body { -webkit-print-color-adjust: exact; }
          .bg-canvas { background-color: white !important; }
          text { fill: black !important; text-shadow: none !important; }
          path.contig { stroke-opacity: 0.8 !important; }
          path.edge { stroke: #000 !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
