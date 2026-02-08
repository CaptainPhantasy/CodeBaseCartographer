/**
 * Complexity Service
 * Calculates and analyzes code complexity metrics
 */

export interface ComplexityMetrics {
  cyclomatic: number;
  linesOfCode: number;
  maintainabilityIndex: number;
  complexity: 'low' | 'medium' | 'high' | 'very-high';
}

export interface FileComplexity {
  path: string;
  metrics: ComplexityMetrics;
}

export interface ProjectComplexity {
  totalFiles: number;
  averageCyclomatic: number;
  totalLinesOfCode: number;
  averageMaintainability: number;
  distribution: {
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
  };
  files: FileComplexity[];
}

/**
 * Calculate cyclomatic complexity from code
 * Simple formula: decision points * 2 + 1
 */
export function calculateCyclomaticComplexity(code: string): number {
  const decisionPatterns = [
    /\bif\b/g,
    /\belse if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bswitch\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\./g,  // optional chaining
    /\?[^:]/g // ternary operator
  ];

  let decisionPoints = 0;
  for (const pattern of decisionPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      decisionPoints += matches.length;
    }
  }

  return decisionPoints * 2 + 1;
}

/**
 * Calculate lines of code (excluding comments and blank lines)
 */
export function calculateLinesOfCode(code: string): number {
  const lines = code.split('\n');
  let loc = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip single-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
      continue;
    }

    // Skip multi-line comment markers
    if (trimmed.startsWith('/*') || trimmed.startsWith('*/') || trimmed.startsWith('*')) {
      continue;
    }

    loc++;
  }

  return loc;
}

/**
 * Calculate maintainability index
 * Simplified formula based on Microsoft's MI
 */
export function calculateMaintainabilityIndex(
  cyclomatic: number,
  loc: number
): number {
  // Prevent division by zero
  const safeLoc = Math.max(1, loc);
  const safeCyclomatic = Math.max(1, cyclomatic);

  // Simplified maintainability index (0-100 scale)
  const mi = Math.max(0, Math.min(100,
    171 - 5.2 * Math.log(safeLoc) - 0.23 * safeCyclomatic
  ));

  return Math.round(mi);
}

/**
 * Determine complexity level from metrics
 */
export function getComplexityLevel(metrics: ComplexityMetrics): ComplexityMetrics['complexity'] {
  if (metrics.cyclomatic <= 5 || metrics.maintainabilityIndex >= 85) {
    return 'low';
  } else if (metrics.cyclomatic <= 10 || metrics.maintainabilityIndex >= 65) {
    return 'medium';
  } else if (metrics.cyclomatic <= 20 || metrics.maintainabilityIndex >= 40) {
    return 'high';
  } else {
    return 'very-high';
  }
}

/**
 * Calculate all complexity metrics for code
 */
export function calculateComplexity(code: string, filePath?: string): ComplexityMetrics {
  const cyclomatic = calculateCyclomaticComplexity(code);
  const linesOfCode = calculateLinesOfCode(code);
  const maintainabilityIndex = calculateMaintainabilityIndex(cyclomatic, linesOfCode);

  const metrics: ComplexityMetrics = {
    cyclomatic,
    linesOfCode,
    maintainabilityIndex,
    complexity: 'low'
  };

  metrics.complexity = getComplexityLevel(metrics);

  return metrics;
}

/**
 * Get color for complexity level
 */
export function getComplexityColor(complexity: ComplexityMetrics['complexity']): string {
  switch (complexity) {
    case 'low':
      return '#10b981'; // green
    case 'medium':
      return '#3b82f6'; // blue
    case 'high':
      return '#f59e0b'; // orange
    case 'very-high':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Calculate project-wide complexity metrics
 */
export function calculateProjectComplexity(files: Array<{
  path: string;
  content: string;
}>): ProjectComplexity {
  const fileComplexities: FileComplexity[] = [];
  let totalCyclomatic = 0;
  let totalLOC = 0;
  let totalMI = 0;

  for (const file of files) {
    const metrics = calculateComplexity(file.content, file.path);
    fileComplexities.push({ path: file.path, metrics });
    totalCyclomatic += metrics.cyclomatic;
    totalLOC += metrics.linesOfCode;
    totalMI += metrics.maintainabilityIndex;
  }

  const count = files.length || 1;

  // Calculate distribution
  const distribution = {
    low: 0,
    medium: 0,
    high: 0,
    veryHigh: 0
  };

  for (const { metrics } of fileComplexities) {
    distribution[metrics.complexity]++;
  }

  return {
    totalFiles: files.length,
    averageCyclomatic: totalCyclomatic / count,
    totalLinesOfCode: totalLOC,
    averageMaintainability: totalMI / count,
    distribution,
    files: fileComplexities
  };
}
