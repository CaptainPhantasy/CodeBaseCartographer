import React from 'react';

const paths: Record<string, string> = {
  Connect: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  Chat: 'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0ZM7 9h10M7 13h7',
  Map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16M15 5v16',
  Chart: 'M3 3v18h18M7 16v-5M12 16V7M17 16v-9',
  Check: 'm5 12 4 4L19 6',
  Video: 'M3 5h12v14H3V5Zm12 5 6-4v12l-6-4',
  Settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  Mic: 'M9 3h6v11H9V3ZM5 10v3a7 7 0 0 0 14 0v-3M12 20v2M8 22h8',
  Volume: 'M11 4 6 8H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
  Search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  File: 'M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8M8 16h6',
  Folder: 'M3 5h7l2 3h9v12H3V5Z',
  Close: 'm6 6 12 12M6 18 18 6',
  Plus: 'M12 4v16M4 12h16',
  Trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  Send: 'm3 3 18 9-18 9 4-9-4-9Zm4 9h14',
  Compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2 6-6 2 2-6 6-2',
  Warning: 'm12 3 10 18H2L12 3Zm0 5v6M12 17v1',
  Code: 'm8 6-6 6 6 6M16 6l6 6-6 6m-3-14-2 16',
  Eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  Upload: 'M12 17V3m-5 5 5-5 5 5M4 16v5h16v-5',
  Download: 'M12 3v14m-5-5 5 5 5-5M4 18v3h16v-3',
};
export function ProductIcon({ name = 'Compass' }: { name?: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="product-icon"><path d={paths[name] || paths.Compass} /></svg>;
}
