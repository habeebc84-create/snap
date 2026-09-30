import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  Download,
  FileStack,
  LayoutDashboard,
  Menu,
  ScanLine,
  Settings as SettingsIcon,
  ShieldCheck,
  X,
} from "lucide-react";
import { LocalStatusPill, SecurePill } from "./status";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/documents", label: "Documents", icon: FileStack },
  { to: "/scan", label: "Scan & Upload", icon: ScanLine },
  { to: "/review", label: "Review Queue", icon: ClipboardCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/exports", label: "Exports", icon: Download },
  { to: "/security", label: "Security", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const MOBILE_ITEMS = NAV_ITEMS.filter((item) =>
  ["/dashboard", "/documents", "/scan", "/review", "/analytics"].includes(item.to),
);

function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SecureDoc AI home">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-900 shadow-soft">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-semibold text-white">SecureDoc AI</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
              Private by design
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-thin" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn("nav-item", isActive && "nav-item-active")
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-white/45">
          Documents never leave this device. No cloud upload, no telemetry.
        </p>
      </div>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const online = useOnlineStatus();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-hidden bg-sidebar lg:block">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(600px 300px at 0% 0%, hsl(172 66% 30% / 0.35), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="workspace-surface relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="app-depth-grid pointer-events-none absolute inset-0 z-[-1] opacity-40" aria-hidden="true" />
        <div className="workspace-orb -right-40 top-8" aria-hidden="true" />
        <div className="workspace-orb -bottom-52 -left-44 opacity-[0.14]" aria-hidden="true" />
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-border/70 bg-card/60 p-2 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="font-display text-sm font-semibold lg:hidden">SecureDoc AI</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!online && (
                <span className="hidden text-xs text-amber-600 dark:text-amber-400 md:inline">
                  Offline mode active — all processing continues locally.
                </span>
              )}
              <LocalStatusPill offline={!online} />
              <SecurePill />
              <NavLink
                to="/settings"
                aria-label="Settings"
                className="rounded-lg border border-border/70 bg-card/60 p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <SettingsIcon className="h-4 w-4" aria-hidden="true" />
              </NavLink>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {MOBILE_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-w-16 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label.split(" ")[0]}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
