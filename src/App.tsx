import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Skeleton } from "@/components/ui/skeleton";

// Eager load critical routes
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load non-critical routes for better initial bundle size
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewTrip = lazy(() => import("./pages/NewTrip"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const TripCompare = lazy(() => import("./pages/TripCompare"));
const TripMapPage = lazy(() => import("./pages/TripMapPage"));
const Terms = lazy(() => import("./pages/Terms"));
const ShareTrip = lazy(() => import("./pages/ShareTrip"));
const Billing = lazy(() => import("./pages/Billing"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Development-only debug page
const DebugRLS = import.meta.env.DEV
  ? lazy(() => import("./pages/DebugRLS"))
  : () => null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="space-y-4 w-full max-w-md px-4">
        <Skeleton className="h-8 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/app" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/app/new" element={
                <ProtectedRoute>
                  <NewTrip />
                </ProtectedRoute>
              } />
              <Route path="/app/trip/:id" element={
                <ProtectedRoute>
                  <TripDetail />
                </ProtectedRoute>
              } />
              <Route path="/app/trip/:id/compare" element={
                <ProtectedRoute>
                  <TripCompare />
                </ProtectedRoute>
              } />
              <Route path="/app/trip/:id/map" element={
                <ProtectedRoute>
                  <TripMapPage />
                </ProtectedRoute>
              } />
              <Route path="/billing" element={
                <ProtectedRoute>
                  <Billing />
                </ProtectedRoute>
              } />
              {/* Public share route - no auth required */}
              <Route path="/share/:token" element={<ShareTrip />} />
              {/* Development-only debug route */}
              {import.meta.env.DEV && (
                <Route path="/debug-rls" element={<DebugRLS />} />
              )}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;