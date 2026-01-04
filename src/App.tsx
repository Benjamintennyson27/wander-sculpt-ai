import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NewTrip from "./pages/NewTrip";
import TripDetail from "./pages/TripDetail";
import TripCompare from "./pages/TripCompare";
import TripMapPage from "./pages/TripMapPage";
import Terms from "./pages/Terms";
import ShareTrip from "./pages/ShareTrip";
import Billing from "./pages/Billing";
import NotFound from "./pages/NotFound";

// Development-only debug page
const DebugRLS = import.meta.env.DEV
  ? await import("./pages/DebugRLS").then((m) => m.default)
  : () => null;

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
