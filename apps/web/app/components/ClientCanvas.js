// ClientCanvas.js
// WHY THIS FILE EXISTS:
// Next.js App Router pages are Server Components by default.
// ssr: false only works inside a Client Component ('use client').
// So we create this thin wrapper just to handle the dynamic import.

'use client';

import dynamic from 'next/dynamic';

const Canvas = dynamic(() => import('./Canvas'), { ssr: false });

export default function ClientCanvas({roomId}) {
  return <Canvas roomId={roomId}/>;
}