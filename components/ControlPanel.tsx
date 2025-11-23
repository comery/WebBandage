import React, { useState, useRef, useMemo } from 'react';
import { GraphSettings, ColorMode, AssemblyNode } from '../types';
import { Settings, Activity, Layers, Share2, RefreshCw, ChevronDown, ChevronRight, Eye, Move, Type, Info, Upload, FileInput } from 'lucide-react';

interface ControlPanelProps {
  settings: GraphSettings;
  onSettingsChange: (newSettings: GraphSettings) => void;
  onRegenerate: () => void;
  onImportGFA: (content: string) => void;
  isOpen: boolean;
  toggleOpen: () => void;
  selectedNodes: AssemblyNode[];
}

const ControlSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          {icon}
          {title}
        </div>
        {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  onRegenerate,
  onImportGFA,
  isOpen,
  toggleOpen,
  selectedNodes
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gfaInputRef = useRef<HTMLInputElement>(null);

  const handleChange = <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleLabelContentChange = (key: keyof GraphSettings['labelContent']) => {
    onSettingsChange({
      ...settings,
      labelContent: {
        ...settings.labelContent,
        [key]: !settings.labelContent[key]
      }
    });
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const lines = text.split('\n');
        const newLabels: Record<string, string> = {};
        
        lines.forEach(line => {
          if (!line.trim()) return;
          const parts = line.split(',');
          if (parts.length >= 2) {
            const id = parts[0].trim();
            const label = parts.slice(1).join(',').trim();
            newLabels[id] = label;
          }
        });

        onSettingsChange({
          ...settings,
          csvLabels: newLabels,
          labelContent: {
            ...settings.labelContent,
            csv: true 
          }
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGfaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) onImportGFA(text);
    };
    reader.readAsText(file);
    if (gfaInputRef.current) gfaInputRef.current.value = '';
  };

  // Calculate Statistics for Selection
  const selectionStats = useMemo(() => {
    if (selectedNodes.length === 0) return null;
    
    const count = selectedNodes.length;
    const totalLength = selectedNodes.reduce((acc, node) => acc + node.length, 0);
    // Weighted average coverage: sum(len * cov) / sum(len)
    const weightedCoverage = selectedNodes.reduce((acc, node) => acc + (node.length * node.coverage), 0) / totalLength;

    return {
      count,
      totalLength,
      weightedCoverage
    };
  }, [selectedNodes]);

  return (
    <div 
      className={`fixed left-0 top-0 bottom-0 bg-panel border-r border-slate-700 shadow-2xl transition-all duration-300 z-20 flex flex-col ${isOpen ? 'w-80' : 'w-0'} overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900 shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Activity size={20} />
          <h1 className="font-bold text-lg tracking-tight font-mono">WebBandage</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Selection Info */}
        <div className="p-4 bg-blue-900/10 border-b border-blue-900/30">
          <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">
            {selectedNodes.length > 1 ? "Selection Statistics" : "Active Contig"}
          </h3>
          
          {selectedNodes.length === 0 && (
            <div className="text-sm text-slate-500 italic">No nodes selected</div>
          )}

          {selectedNodes.length === 1 && (
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">ID</span>
                <span className="text-slate-200">{selectedNodes[0].id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Length</span>
                <span className="text-slate-200">{Math.round(selectedNodes[0].length).toLocaleString()} bp</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coverage</span>
                <span className="text-green-400">{selectedNodes[0].coverage.toFixed(2)}x</span>
              </div>
            </div>
          )}

          {selectedNodes.length > 1 && selectionStats && (
             <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Count</span>
                <span className="text-slate-200">{selectionStats.count} nodes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Len</span>
                <span className="text-slate-200">
                   {selectionStats.totalLength > 1000000 
                     ? (selectionStats.totalLength / 1000000).toFixed(2) + " Mbp" 
                     : Math.round(selectionStats.totalLength).toLocaleString() + " bp"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Avg Cov</span>
                <span className="text-green-400">{selectionStats.weightedCoverage.toFixed(2)}x</span>
              </div>
            </div>
          )}
        </div>

        <ControlSection title="Actions" icon={<Settings size={16} />} defaultOpen={true}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Import Data</label>
              <button
                onClick={() => gfaInputRef.current?.click()}
                className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors border border-blue-600"
              >
                <FileInput size={14} />
                Upload GFA File
              </button>
              <input 
                  type="file" 
                  ref={gfaInputRef}
                  onChange={handleGfaUpload}
                  accept=".gfa,.txt"
                  className="hidden"
              />
            </div>

            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs text-slate-400 mb-2 block">Demo Data</label>
              <button
                onClick={onRegenerate}
                className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-600"
              >
                <RefreshCw size={14} />
                Randomize Dataset
              </button>
            </div>
          </div>
        </ControlSection>

        <ControlSection title="Node labels" icon={<Type size={16} />} defaultOpen={false}>
           {/* ... existing label controls ... */}
           <div className="flex gap-3">
            <div className="text-blue-400 pt-1">
              <Info size={16} />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-y-2 gap-x-4 text-sm text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.labelContent.custom}
                  onChange={() => handleLabelContentChange('custom')}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                />
                Custom
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.labelContent.name}
                  onChange={() => handleLabelContentChange('name')}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                />
                Name
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.labelContent.length}
                  onChange={() => handleLabelContentChange('length')}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                />
                Length
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.labelContent.depth}
                  onChange={() => handleLabelContentChange('depth')}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                />
                Depth
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.labelContent.blast}
                  onChange={() => handleLabelContentChange('blast')}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                />
                BLAST hits
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.labelContent.csv}
                  onChange={() => handleLabelContentChange('csv')}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                />
                CSV data
              </label>
            </div>
          </div>

          {settings.labelContent.csv && (
            <div className="ml-7 mt-3 mb-1 p-2 bg-slate-800/50 rounded border border-slate-700">
              <div className="flex items-center justify-between gap-2">
                 <span className="text-xs text-slate-400 truncate">
                   {Object.keys(settings.csvLabels).length > 0 
                      ? `${Object.keys(settings.csvLabels).length} labels loaded` 
                      : "No labels loaded"}
                 </span>
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wide rounded transition-colors"
                 >
                   <Upload size={10} />
                   Upload
                 </button>
                 <input 
                   type="file" 
                   ref={fileInputRef}
                   onChange={handleCsvUpload}
                   accept=".csv,.txt,.tsv"
                   className="hidden"
                 />
              </div>
              <div className="text-[9px] text-slate-500 mt-1">Format: NodeID, Label Text</div>
            </div>
          )}
          
          <div className="pl-7 pt-3 flex items-center gap-4">
            <button className="px-3 py-1 bg-white text-slate-900 text-xs font-semibold rounded shadow-sm hover:bg-slate-100 transition-colors">
              Font
            </button>
             <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                <input 
                  type="checkbox" 
                  checked={settings.labelOutline}
                  onChange={(e) => handleChange('labelOutline', e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-offset-slate-900"
                />
                Text outline
              </label>
          </div>
        </ControlSection>

        <ControlSection title="Layout Physics" icon={<Move size={16} />} defaultOpen={false}>
          <div>
            <label className="flex justify-between text-xs text-slate-400 mb-2">
              Contig Width
              <span>{settings.nodeWidthScale}px</span>
            </label>
            <input
              type="range"
              min="4"
              max="30"
              value={settings.nodeWidthScale}
              onChange={(e) => handleChange('nodeWidthScale', Number(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <label className="flex justify-between text-xs text-slate-400 mb-2">
              Linear Scaling
              <span>{settings.nodeLengthScale.toFixed(3)}</span>
            </label>
            <input
              type="range"
              min="0.001"
              max="0.2"
              step="0.001"
              value={settings.nodeLengthScale}
              onChange={(e) => handleChange('nodeLengthScale', Number(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <label className="flex justify-between text-xs text-slate-400 mb-2">
              Link Distance
              <span>{settings.linkDistance}</span>
            </label>
            <input
              type="range"
              min="0"
              max="300"
              value={settings.linkDistance}
              onChange={(e) => handleChange('linkDistance', Number(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div>
            <label className="flex justify-between text-xs text-slate-400 mb-2">
              Repulsion
              <span>{settings.chargeStrength}</span>
            </label>
            <input
              type="range"
              min="-1000"
              max="-10"
              value={settings.chargeStrength}
              onChange={(e) => handleChange('chargeStrength', Number(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </ControlSection>

        <ControlSection title="Visualization" icon={<Eye size={16} />} defaultOpen={true}>
          {/* Color Mode */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block">Color Scheme</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-lg">
              {[ColorMode.DEPTH, ColorMode.LENGTH, ColorMode.RANDOM, ColorMode.UNIFORM].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleChange('colorMode', mode)}
                  className={`px-2 py-1.5 text-[10px] uppercase font-bold tracking-wide rounded-md transition-colors ${
                    settings.colorMode === mode 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-1 mt-2">
            <span className="text-sm text-slate-300">Show All Labels</span>
            <button
              onClick={() => handleChange('showLabels', !settings.showLabels)}
              className={`w-9 h-5 rounded-full transition-colors relative ${settings.showLabels ? 'bg-blue-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.showLabels ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-slate-300">Show Directions</span>
            <button
              onClick={() => handleChange('showArrows', !settings.showArrows)}
              className={`w-9 h-5 rounded-full transition-colors relative ${settings.showArrows ? 'bg-blue-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.showArrows ? 'translate-x-4' : ''}`} />
            </button>
          </div>
        </ControlSection>
      </div>
      
      {/* Footer info */}
      <div className="p-3 text-[10px] text-slate-600 border-t border-slate-800 text-center uppercase tracking-widest shrink-0">
        v1.0.0 • GFA Explorer
      </div>
    </div>
  );
};

export default ControlPanel;