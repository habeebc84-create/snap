import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Skeleton } from "./components/ui";

// The home page is the first meaningful paint. Keep it in the entry chunk so
// visitors never wait on a second request before seeing the primary CTA.
import Landing from "./pages/Landing";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Documents = lazy(() => import("./pages/Documents"));
const ScanUpload = lazy(() => import("./pages/ScanUpload"));
const DocumentViewer = lazy(() => import("./pages/DocumentViewer"));
const ReviewQueue = lazy(() => import("./pages/ReviewQueue"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Exports = lazy(() => import("./pages/Exports"));
const Security = lazy(() => import("./pages/Security"));
const Settings = lazy(() => import("./pages/Settings"));

function RouteFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you're looking for doesn't exist in this workspace.
      </p>
      <a href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to dashboard
      </a>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route index element={<Landing />} />
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="documents" element={<Documents />} />
            <Route path="documents/:id" element={<DocumentViewer />} />
            <Route path="scan" element={<ScanUpload />} />
            <Route path="review" element={<ReviewQueue />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="exports" element={<Exports />} />
            <Route path="security" element={<Security />} />
            <Route path="settings" element={<Settings />} />
            <Route path="home" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
