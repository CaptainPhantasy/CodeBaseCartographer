// Simple service to handle codebase ingestion
import { FileFilterOptions, getFileCategory, isHiddenFile } from '../types/fileTypes';

export interface IngestOptions {
  includeHidden: boolean;
  fileCategories: string[];
}

export const fetchGithubTree = async (
  repoUrl: string,
  options?: Partial<IngestOptions>
): Promise<string[]> => {
  try {
    // Basic parsing for github.com/owner/repo
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error("Invalid GitHub URL format");

    const owner = match[1];
    const repo = match[2];
    
    // Using the recursive tree API to get flat file list
    // Note: This hits public API rate limits quickly without auth.
    // For a real app, we'd ask for a token.
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
        // Try 'master' if main fails
        const masterUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
        const masterRes = await fetch(masterUrl);
        if (!masterRes.ok) throw new Error("Could not fetch repo tree (check branch name or rate limits)");
        return parseTreeResponse(await masterRes.json());
    }

    return parseTreeResponse(await response.json());
  } catch (error) {
    console.error("GitHub Ingest Error:", error);
    throw error;
  }
};

const parseTreeResponse = (data: any, options?: Partial<IngestOptions>): string[] => {
    if (!data.tree || !Array.isArray(data.tree)) return [];

    const includeHidden = options?.includeHidden ?? false;
    const fileCategories = options?.fileCategories;

    // Filter for blobs (files) and apply filters
    return data.tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path)
        .filter((path: string) => {
            // Filter hidden files
            if (!includeHidden && isHiddenFile(path)) {
                return false;
            }

            // Filter by category if specified
            if (fileCategories && fileCategories.length > 0) {
                const category = getFileCategory(path);
                if (!category || !fileCategories.includes(category)) {
                    return false;
                }
            }

            return true;
        });
};

export const processFileSelect = (
    files: FileList,
    options?: Partial<IngestOptions>
): string[] => {
    const includeHidden = options?.includeHidden ?? false;
    const fileCategories = options?.fileCategories;

    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = file.webkitRelativePath || file.name;

        // Filter hidden files
        if (!includeHidden && isHiddenFile(path)) {
            continue;
        }

        // Filter by category if specified
        if (fileCategories && fileCategories.length > 0) {
            const category = getFileCategory(path);
            if (!category || !fileCategories.includes(category)) {
                continue;
            }
        }

        paths.push(path);
    }
    return paths;
};
