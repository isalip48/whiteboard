// page.js is a Server Component (no 'use client').
// It just renders the ClientCanvas wrapper.
import ClientCanvas from './components/ClientCanvas';

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden">
      <ClientCanvas />
    </main>
  );
}