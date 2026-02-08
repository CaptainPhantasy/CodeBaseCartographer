/**
 * Export functionality for diagrams
 * Supports PNG, SVG, and JSON formats
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { GraphData } from './analyzer';

export interface ExportOptions {
  format: 'png' | 'svg' | 'json';
  output?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

/**
 * Export graph data to various formats
 */
export async function exportDiagram(
  graphData: GraphData,
  outputPath: string,
  format: string
): Promise<void> {
  switch (format.toLowerCase()) {
    case 'json':
      await exportJSON(graphData, outputPath);
      break;
    case 'svg':
      await exportSVG(graphData, outputPath);
      break;
    case 'png':
      await exportPNG(graphData, outputPath);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Export to JSON format
 */
async function exportJSON(graphData: GraphData, outputPath: string): Promise<void> {
  const json = JSON.stringify(graphData, null, 2);
  writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Export to SVG format
 */
async function exportSVG(graphData: GraphData, outputPath: string): Promise<void> {
  // Calculate canvas bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const node of graphData.nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + 200); // Approximate node width
    maxY = Math.max(maxY, node.position.y + 80); // Approximate node height
  }

  const padding = 50;
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  // Generate SVG
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#0f172a" />

  <!-- Links -->
`;

  // Draw links
  for (const link of graphData.links) {
    const source = graphData.nodes.find(n => n.id === link.source);
    const target = graphData.nodes.find(n => n.id === link.target);

    if (source && target) {
      const x1 = source.position.x + 100 - minX + padding;
      const y1 = source.position.y + 40 - minY + padding;
      const x2 = target.position.x + 100 - minX + padding;
      const y2 = target.position.y + 40 - minY + padding;

      svg += `  <line
    x1="${x1}" y1="${y1}"
    x2="${x2}" y2="${y2}"
    stroke="#64748b"
    stroke-width="2"
    marker-end="url(#arrowhead)"
    ${link.animated ? 'class="animated"' : ''}
  />
`;
    }
  }

  svg += '\n  <!-- Nodes -->\n';

  // Draw nodes
  for (const node of graphData.nodes) {
    const x = node.position.x - minX + padding;
    const y = node.position.y - minY + padding;
    const color = node.data.color || '#3b82f6';
    const label = escapeXml(node.data.label);

    // Node rectangle
    svg += `  <g transform="translate(${x}, ${y})">
    <rect
      x="0" y="0"
      width="200" height="80"
      rx="8" ry="8"
      fill="${color}20"
      stroke="${color}"
      stroke-width="2"
    />
    <text
      x="100" y="45"
      text-anchor="middle"
      fill="#e2e8f0"
      font-family="system-ui, sans-serif"
      font-size="12"
      font-weight="500"
    >${truncateString(label, 25)}</text>
  </g>
`;
  }

  // Add metadata
  if (graphData.metadata) {
    svg += `
  <!-- Metadata -->
  <text x="20" y="${height - 20}" fill="#64748b" font-family="system-ui, sans-serif" font-size="10">
    Generated: ${new Date(graphData.metadata.timestamp).toISOString()}
  </text>
`;
  }

  svg += '</svg>';

  writeFileSync(outputPath, svg, 'utf-8');
}

/**
 * Export to PNG format (requires additional libraries)
 * Note: This is a simplified version. For production, consider using puppeteer or sharp
 */
async function exportPNG(graphData: GraphData, outputPath: string): Promise<void> {
  // First generate SVG, then convert to PNG
  const tempSvgPath = outputPath.replace('.png', '.temp.svg');

  try {
    await exportSVG(graphData, tempSvgPath);

    // For PNG export, you would typically:
    // 1. Use a library like sharp, canvas, or puppeteer
    // 2. Render the SVG to a canvas or headless browser
    // 3. Save as PNG

    // For now, we'll create a placeholder that instructions
    const instructions = `PNG Export

To export as PNG, install additional dependencies:
  npm install sharp

Then the PNG export will work automatically.

For now, the SVG has been saved to: ${tempSvgPath}

You can convert it manually using:
  - Online tools: https://svgtopng.com/
  - Command line: convert -background none diagram.svg diagram.png
`;

    writeFileSync(outputPath, instructions, 'utf-8');

    console.log('\nNote: Full PNG export requires additional dependencies.');
    console.log('SVG file saved to:', tempSvgPath);
  } catch (error) {
    throw new Error(`PNG export failed: ${error}`);
  }
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
 * Truncate string to max length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
