import { Loader2 } from 'lucide-react';

// Route-level Suspense fallback. Kept intentionally minimal and full-height
// so swapping between lazy-loaded pages never causes a layout shift.
export default function PageLoader() {
  return (
    <div className="flex items-center justify-center w-full h-[100dvh]" role="status" aria-label="Loading page">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  );
}
