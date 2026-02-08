// Simple service to handle codebase ingestion

export const fetchGithubTree = async (repoUrl: string): Promise<string[]> => {
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

const parseTreeResponse = (data: any): string[] => {
    if (!data.tree || !Array.isArray(data.tree)) return [];
    // Filter for blobs (files) and return paths
    return data.tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path);
};

export const processFileSelect = (files: FileList): string[] => {
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
        // webkitRelativePath gives us the relative path in the folder
        const file = files[i];
        if (file.webkitRelativePath) {
            paths.push(file.webkitRelativePath);
        } else {
            paths.push(file.name);
        }
    }
    return paths;
};
