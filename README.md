# WebBandage — Assembly Graph Explorer

WebBandage is a browser-based tool to visualize assembly graphs from GFA files. It focuses on fast, interactive inspection of contigs and links, lightweight layout physics, and practical export options for figures.

## Highlights

- Upload and parse GFA (`S` and `L` records)
- Two-step workflow: Upload → Draw → Cancel
- Freeze & Select mode with area selection and drag-to-reposition of selected regions
- Node ID search with batch input and in-graph highlighting
- Demo data selector (`demo_graph/*.gfa`) for quick exploration
- Layout physics tuned for contig bars and link forces
- Rich visualization controls (color schemes, labels, arrows, background)
- Export to SVG and print-ready PDF

## Quick Start

- Install dependencies: `npm install`
- Run development server: `npm run dev` (Vite)
- Open the app at the local URL shown in the terminal (e.g., `http://localhost:3000` or `3001`).
- Load a demo dataset from the sidebar (Demo Data), or upload your own GFA.

## Demo Data

- Demo files live under `demo_graph/` and are auto-listed in the sidebar.
- Default selection: `demo_graph/graph.gfa`
- You can add more `.gfa` files to `demo_graph/` and they will appear in the dropdown.

## Workflow

- Upload GFA:
  - Click `Upload GFA File` and select a `.gfa` file.
  - The app parses the file asynchronously and shows progress.
- Draw:
  - Click `Draw` to render the parsed graph.
  - Use `Cancel` to abort parsing/layout if needed.
- Freeze & Select:
  - Toggle to `Freeze & Select` to lock zoom and enable box-selection.
  - Drag the selected region to re-layout that subgraph without resuming simulation.

## Controls (Sidebar)

The sidebar groups controls in a consistent, panel-like UI.

- Actions
  - `Upload GFA File` → choose a GFA file
  - `Draw` / `Cancel` → start or cancel parsing/rendering
  - Demo Data dropdown → choose a demo `.gfa` and `Load`
- Search
  - Input single or multiple Node IDs separated by commas/semicolons/spaces
  - Shows summary: `Total`, `Found`, `Not Found`
  - Highlights matched nodes in the canvas
- Node labels
  - Label content toggles: `Custom`, `Name`, `Length`, `Depth`, `BLAST hits`, `CSV data`
  - CSV labels uploader: expected format `NodeID,Label Text`
  - `Text outline` toggle: enable label stroke for readability
- Layout Physics
  - `Contig Width`: stroke width of contig bars
  - `Linear Scaling`: converts base pairs to pixel length
  - `Minimum Nodes`: filters out small connected components below the threshold (computed via connected components)
  - `Link Distance`: desired length of links in simulation
  - `Charge Strength`: repulsion strength (negative values repel)
- Visualization
  - Color Scheme: `RANDOM`, `LENGTH`, `DEPTH`, `UNIFORM`
  - `Show All Labels`: toggle global label visibility
  - `Show Directions`: toggle arrowheads on links
  - `Background light`: switch entire page and canvas to a light theme (white background) or dark (slate)

## Export

- SVG Export
  - Clones the current SVG and injects a background rectangle matching the current theme
  - Produces a standalone `.svg` file suitable for vector editing
- PDF Export
  - Opens a print-ready window with the current SVG at full page size
  - Uses white background and print-friendly styles

## GFA Support

- `S` (Segment) records are parsed into nodes with `id`, `length`, `coverage` (when available), and optional sequence
- `L` (Link) records are treated as undirected edges for connected-component filtering and as directed edges for arrow display
- Non-standard tags are ignored for layout; they may be reflected in labels if mapped via CSV or custom logic

## Performance & Limits

WebBandage is optimized for interactive use, not for extremely large graphs.

- Very large GFA files are not supported; rendering may be slow or the browser may become unresponsive
- Parsing is asynchronous with a progress indicator and `Cancel` support, but memory usage still grows with file size
- Start with small-to-medium graphs and increase complexity incrementally
- Use `Minimum Nodes` to filter tiny subgraphs and reduce visual clutter
- Avoid loading multi-megabyte sequences unless strictly needed for your analysis

## Tips & Notes

- Zoom & Pan: use the Move mode; Freeze mode disables zoom to enable selection
- Label Readability: on dark background, labels are white with black outline; on light background, labels are dark with white outline
- Connected-component filtering: subgraphs with fewer than `Minimum Nodes` are removed entirely from rendering
- Demo safety: demo files shipped in `demo_graph/` showcase typical structures and are good for UI testing

## Development

- Tooling: Vite, React, TypeScript, D3, Tailwind (CDN config)
- Commands:
  - `npm run dev` — start dev server
  - `npm run build` — build production assets
  - `npm run preview` — preview built output
- Type checking: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`

## Troubleshooting

- Blank page after starting dev: ensure the dev server is running and visit the URL shown in the terminal
- SVG/PDF shows empty content: ensure the canvas rendered successfully before exporting
- Labels look too heavy on light theme: disable `Text outline` or reduce export scale in a vector editor
- Slow interaction on large data: lower `Contig Width`, increase `Link Distance`, and adjust `Charge Strength` to space nodes; also raise `Minimum Nodes` to filter small components

---

WebBandage aims to make assembly graph inspection simpler and faster in the browser. If you have feature requests or specific workflows, feel free to extend the UI controls and parser to your needs.
