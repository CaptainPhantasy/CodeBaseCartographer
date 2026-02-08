/**
 * File Version Store
 * Caches previous versions of files for diff comparison
 * Implements LRU eviction policy to manage memory
 */

interface FileVersion {
  content: string;
  timestamp: number;
  path: string;
}

interface StoredVersion extends FileVersion {
  lastAccessed: number;
}

class FileVersionStore {
  private store: Map<string, StoredVersion> = new Map();
  private maxVersions = 1000; // Maximum number of file versions to store
  private maxAge = 30 * 60 * 1000; // 30 minutes in milliseconds

  /**
   * Store a file version
   */
  storeVersion(path: string, content: string, timestamp?: number): void {
    const now = timestamp || Date.now();

    // Check if we already have a recent version
    const existing = this.store.get(path);
    if (existing && existing.content === content) {
      // Content hasn't changed, just update access time
      existing.lastAccessed = now;
      return;
    }

    // Add new version
    this.store.set(path, {
      path,
      content,
      timestamp: now,
      lastAccessed: now
    });

    // Evict old entries if necessary
    this.evictIfNeeded();
  }

  /**
   * Get previous version of a file
   */
  getPreviousVersion(path: string): FileVersion | null {
    const version = this.store.get(path);
    if (!version) {
      return null;
    }

    // Update last accessed time
    version.lastAccessed = Date.now();

    return {
      path: version.path,
      content: version.content,
      timestamp: version.timestamp
    };
  }

  /**
   * Check if a file has a previous version
   */
  hasPreviousVersion(path: string): boolean {
    return this.store.has(path);
  }

  /**
   * Remove a file version from the store
   */
  removeVersion(path: string): void {
    this.store.delete(path);
  }

  /**
   * Clear all stored versions
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get statistics about the store
   */
  getStats(): { size: number; paths: string[] } {
    return {
      size: this.store.size,
      paths: Array.from(this.store.keys())
    };
  }

  /**
   * Evict old or excess entries
   */
  private evictIfNeeded(): void {
    const now = Date.now();

    // First, evict old entries
    for (const [path, version] of this.store.entries()) {
      if (now - version.lastAccessed > this.maxAge) {
        this.store.delete(path);
      }
    }

    // If still too many, evict least recently used
    if (this.store.size > this.maxVersions) {
      const entries = Array.from(this.store.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toRemove = entries.slice(0, this.store.size - this.maxVersions);
      toRemove.forEach(([path]) => this.store.delete(path));
    }
  }
}

// Singleton instance
let fileVersionStore: FileVersionStore | null = null;

export function getFileVersionStore(): FileVersionStore {
  if (!fileVersionStore) {
    fileVersionStore = new FileVersionStore();
  }
  return fileVersionStore;
}

export default FileVersionStore;
