/**
 * Export utilities for diagrams
 * Supports PNG, PDF, SVG, and JSON formats
 */

import { DiagramData, DiagramNode } from '../types/diagram';

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  quality?: number; // for PNG
  includeMetadata?: boolean;
}

/**
 * Export diagram to various formats
 */
export async function exportDiagram(
  data: DiagramData,
  options: ExportOptions
): Promise<void> {
  const { format, filename = `diagram-${Date.now()}`, includeMetadata = true } = options;

  switch (format) {
    case 'json':
      await exportAsJSON(data, filename, includeMetadata);
      break;
    case 'svg':
      await exportAsSVG(data, filename);
      break;
    case 'png':
      await exportAsPNG(data, filename, options.quality);
      break;
    case 'pdf':
      await exportAsPDF(data, filename);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export as JSON
 */
async function exportAsJSON(
  data: DiagramData,
  filename: string,
  includeMetadata: boolean
): Promise<void> {
  const exportData = includeMetadata
    ? {
        ...data,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }
    : data;

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Export as SVG
 */
async function exportAsSVG(data: DiagramData, filename: string): Promise<void> {
  const svg = generateSVG(data);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, `${filename}.svg`);
}

/**
 * Export as PNG
 */
async function exportAsPNG(
  data: DiagramData,
  filename: string,
  quality = 1
): Promise<void> {
  // First generate SVG
  const svg = generateSVG(data);

  // Create an image from SVG
  const img = new Image();
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Calculate dimensions
        const bounds = calculateBounds(data);
        canvas.width = bounds.width;
        canvas.height = bounds.height;

        // Fill background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Export as PNG
        canvas.toBlob(
          (blob) => {
            if (blob) {
              downloadBlob(blob, `${filename}.png`);
              URL.revokeObjectURL(url);
              resolve();
            } else {
              reject(new Error('Failed to create PNG blob'));
            }
          },
          'image/png',
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load SVG image'));
      URL.revokeObjectURL(url);
    };

    img.src = url;
  });
}

/**
 * Export as PDF
 */
async function exportAsPDF(data: DiagramData, filename: string): Promise<void> {
  // For PDF export, we'd typically use a library like jsPDF
  // For now, we'll export as SVG and suggest conversion
  console.warn('PDF export requires additional library (jsPDF)');
  await exportAsSVG(data, filename);

  // Show message to user
  alert(`PDF export is not fully implemented. SVG file has been saved.\n\nYou can convert SVG to PDF using:\n- Online tools: https://svgtopdf.com/\n- Command line:inkscape diagram.svg --export-type=pdf`);
}

/**
 * Generate SVG from diagram data
 */
function generateSVG(data: DiagramData): string {
  const bounds = calculateBounds(data);
  const padding = 50;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${bounds.width + padding * 2}"
     height="${bounds.height + padding * 2}"
     viewBox="0 0 ${bounds.width + padding * 2} ${bounds.height + padding * 2}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
    </marker>
    <style>
      .node-rect { transition: all 0.2s ease; }
      .node-rect:hover { filter: brightness(1.1); }
      .edge-line { stroke-linecap: round; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#0f172a" />

  <!-- Grid pattern -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#334155" opacity="0.5"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />

  <!-- Edges -->
`;

  // Draw edges
  for (const edge of data.edges) {
    const source = data.nodes.find(n => n.id === edge.source);
    const target = data.nodes.find(n => n.id === edge.target);

    if (source && target) {
      const x1 = source.position.x + 100 - bounds.minX + padding;
      const y1 = source.position.y + 40 - bounds.minY + padding;
      const x2 = target.position.x + 100 - bounds.minX + padding;
      const y2 = target.position.y + 40 - bounds.minY + padding;

      svg += `  <line
    class="edge-line"
    x1="${x1}" y1="${y1}"
    x2="${x2}" y2="${y2}"
    stroke="#64748b"
    stroke-width="2"
    marker-end="url(#arrowhead)"
    ${edge.animated ? 'stroke-dasharray="5,5"' : ''}
  />
`;
    }
  }

  // Nodes
  svg += '\n  <!-- Nodes -->\n';

  for (const node of data.nodes) {
    const x = node.position.x - bounds.minX + padding;
    const y = node.position.y - bounds.minY + padding;
    const color = (node.data as any).color || '#3b82f6';
    const label = (node.data as any).label || node.id;
    const description = (node.data as any).description;

    svg += `  <g class="node-group" transform="translate(${x}, ${y})">
    <rect
      class="node-rect"
      x="0" y="0"
      width="200" height="80"
      rx="8" ry="8"
      fill="${color}20"
      stroke="${color}"
      stroke-width="2"
    />
    <text
      x="100" y="${description ? 35 : 45}"
      text-anchor="middle"
      fill="#e2e8f0"
      font-family="system-ui, -apple-system, sans-serif"
      font-size="12"
      font-weight="500"
    >${escapeXml(label.substring(0, 30))}${label.length > 30 ? '...' : ''}</text>
    ${description ? `
    <text
      x="100" y="55"
      text-anchor="middle"
      fill="#94a3b8"
      font-family="system-ui, -apple-system, sans-serif"
      font-size="10"
    >${escapeXml(description.substring(0, 40))}${description.length > 40 ? '...' : ''}</text>
    ` : ''}
  </g>
`;
  }

  // Metadata
  svg += `
  <!-- Metadata -->
  <text x="${padding}" y="${bounds.height + padding * 2 - 20}"
        fill="#64748b"
        font-family="system-ui, sans-serif"
        font-size="10">
    Generated: ${new Date().toISOString()} | Nodes: ${data.nodes.length} | Edges: ${data.edges.length}
  </text>
</svg>`;

  return svg;
}

/**
 * Calculate bounds of diagram
 */
function calculateBounds(data: DiagramData): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const node of data.nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + 200);
    maxY = Math.max(maxY, node.position.y + 80);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate embed code
 */
export function generateEmbedCode(snapshotId: string, options: {
  width?: string;
  height?: string;
  theme?: 'light' | 'dark';
} = {}): string {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams();
  params.set('snapshot', snapshotId);

  if (options.theme) params.set('theme', options.theme);

  const src = `${baseUrl}/embed?${params.toString()}`;

  return `<iframe
  src="${src}"
  width="${options.width || '100%'}"
  height="${options.height || '600px'}"
  frameborder="0"
  allowfullscreen
></iframe>`;
}
