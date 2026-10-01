import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Braces,
  Building2,
  CheckCircle2,
  Database,
  FileCheck2,
  FileStack,
  Fingerprint,
  ScanLine,
  ScanText,
  Search,
  ShieldCheck,
  Tags,
  UserCheck,
  Workflow,
} from "lucide-react";
import { cn } from "../lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

function CtaLink({
  to,
  children,
  variant = "liquid",
  className,
}: {
  to: string;
  children: React.ReactNode;
  variant?: "liquid" | "ghost";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative inline-flex h-11 items-center justify-center gap-2 px-6 text-sm font-medium transition-all active:scale-[0.98]",
        variant === "liquid" ? "lg-btn" : "lg-btn-ghost",
        className,
      )}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </Link>
  );
}

/** Glow progress bar — self-contained so it never picks up app-theme colors. */
function GlowBar({ value }: { value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
          style={{ width: `${percent}%`, boxShadow: "0 0 14px rgba(34,211,238,0.7)" }}
        />
      </div>
      <span className="text-[11px] font-medium tabular-nums text-white/60">
        {percent}%
      </span>
    </div>
  );
}

const STATS = [
  { value: "0", label: "bytes leave the device", icon: ShieldCheck },
  { value: "9", label: "local pipeline stages", icon: Workflow },
  { value: "4", label: "export formats", icon: FileStack },
];

const INVOICE_FIELDS = [
  { label: "Invoice number", value: "INV-2026-1042", score: 0.97 },
  { label: "Vendor", value: "Northwind Traders Pvt Ltd", score: 0.92 },
  { label: "GSTIN", value: "27AAACA1234A1Z5", score: 0.89 },
  { label: "Invoice date", value: "26 Sep 2026", score: 0.95 },
];

const PIPELINE_STAGES = [
  { icon: ScanLine, label: "Upload / scan", hint: "PDF · PNG · JPG · WebP" },
  { icon: FileCheck2, label: "Validation", hint: "Magic bytes · size" },
  { icon: Workflow, label: "Preprocess", hint: "Denoise · deskew" },
  { icon: ScanText, label: "OCR", hint: "Tesseract, on-device" },
  { icon: Tags, label: "Classify", hint: "Invoice / receipt / …" },
  { icon: Braces, label: "Extract", hint: "Fields + line items" },
  { icon: ShieldCheck, label: "Validate", hint: "Math · GSTIN · dates" },
  { icon: UserCheck, label: "Review", hint: "You confirm the data" },
  { icon: Database, label: "Store", hint: "Local SQLite only" },
];

const FEATURES = [
  {
    icon: ScanText,
    title: "Real OCR, on this device",
    body: "Tesseract reads your scans and photos through a pluggable OCRProvider — no text ever leaves the machine, and other engines slot in behind the same interface.",
  },
  {
    icon: Tags,
    title: "Hybrid classification & extraction",
    body: "A deterministic keyword classifier always works; an ONNX model slot upgrades it when you drop a model in models/. Extraction layers regex patterns over document-aware rules.",
  },
  {
    icon: BarChart3,
    title: "Confidence on every field",
    body: "OCR, model, pattern and validation signals blend into one score per field, so you know exactly which values to double-check before you trust them.",
  },
  {
    icon: CheckCircle2,
    title: "Validation that checks the math",
    body: "Subtotal + tax − discount ≈ total, GSTIN structure, date ordering, tax-rate plausibility and line-item sums are verified before anything is saved.",
  },
  {
    icon: UserCheck,
    title: "Human review built in",
    body: "Low-confidence and failing documents land in a review queue. Correct a value once, and the original vs. corrected values are recorded locally.",
  },
  {
    icon: Search,
    title: "Search, analytics, export",
    body: "Filter by vendor, invoice number, GSTIN, amount or date. Charts are computed from your local database. Export JSON, CSV, XLSX or a PDF report.",
  },
];

const AUDIENCE = [
  { icon: Building2, label: "Small businesses" },
  { icon: Database, label: "Accountants & CA offices" },
  { icon: FileStack, label: "Procurement teams" },
  { icon: ShieldCheck, label: "Legal teams" },
  { icon: Fingerprint, label: "Freelancers" },
  { icon: ScanLine, label: "Sensitive paperwork" },
];

const PRIVACY_POINTS = [
  "Documents are stored under generated UUID names — the original filename is metadata only.",
  "Audit log records actions and counts, never OCR text or field values.",
  "Permanent deletion removes the file, processed pages, OCR text and extracted fields together.",
  "Cloud processing, telemetry and analytics are off by default and require explicit consent.",
];

export default function Landing() {
  const reduceMotion = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [6, -6]), {
    stiffness: 170,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 170,
    damping: 18,
  });

  const handleTiltMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // Touch has no hover, so tilting on it only fights the scroll gesture.
    if (reduceMotion || event.pointerType === "touch" || !tiltRef.current) return;
    const rect = tiltRef.current.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  };

  const handleTiltLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div className="lg-stage min-h-screen overflow-hidden">
      {/* ------------------------------------------------ liquid backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="lg-orb lg-orb-purple" />
        <div className="lg-orb lg-orb-cyan" />
        <div className="lg-orb lg-orb-violet" />
        <div className="lg-grid-overlay absolute inset-0" />
      </div>

      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-40 pt-3">
        <div className="lg-glass mx-auto flex h-14 w-full max-w-6xl items-center justify-between rounded-2xl px-3 sm:px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-[0_0_26px_rgba(139,92,246,0.6)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold text-white">
                SecureDoc AI
              </span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-white/45">
                Private by design
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-6 text-sm text-white/60 md:flex"
            aria-label="Landing"
          >
            <a href="#pipeline" className="transition-colors hover:text-white">
              Pipeline
            </a>
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-white">
              Privacy
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <CtaLink to="/dashboard" className="hidden h-9 px-4 text-[13px] sm:inline-flex">
              Open the workspace
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CtaLink>
            <Link
              to="/dashboard"
              className="lg-btn-ghost rounded-xl p-2 sm:hidden"
              aria-label="Open the workspace"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- hero */}
      <section className="relative">
        <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-24">
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            variants={container}
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-xl"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 animate-pulse-dot rounded-full bg-cyan-400" />
              </span>
              LOCAL PROCESSING — on this device
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="lg-glow-text mt-7 font-display text-4xl font-semibold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-[3.6rem]"
            >
              Your documents stay on your device.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg"
            >
              SecureDoc AI turns invoices and receipts into structured data with
              on-device OCR, classification, extraction and validation — then
              lets you correct anything before it hits your local database.
              <span className="mt-2 block text-white/90">
                No cloud upload. No API keys. No telemetry.
              </span>
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
              <CtaLink to="/dashboard">
                Open the workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </CtaLink>
              <CtaLink to="/scan" variant="ghost">
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                Scan your first document
              </CtaLink>
            </motion.div>

            {/* 3D overlapping glass stat tiles */}
            <motion.div
              variants={fadeUp}
              className="lg-tile-stack mt-12 max-w-md [perspective:1100px]"
            >
              {STATS.map((stat, index) => (
                <div
                  key={stat.label}
                  className={cn(
                    "lg-tile lg-glass lg-hairline flex items-center justify-between gap-4 rounded-2xl px-5 py-4",
                    index === 1 && "relative z-10",
                    index === 2 && "relative z-20",
                  )}
                >
                  <div>
                    <p className="font-display text-2xl font-semibold lg-text-gradient">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-xs text-white/55">{stat.label}</p>
                  </div>
                  <stat.icon className="h-5 w-5 text-cyan-300/80" aria-hidden="true" />
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* --------------------------- isometric floating glass invoice */}
          <motion.div
            ref={tiltRef}
            initial={reduceMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            onPointerMove={handleTiltMove}
            onPointerLeave={handleTiltLeave}
            style={
              reduceMotion
                ? undefined
                : { rotateX, rotateY, transformPerspective: 1500 }
            }
            className="relative mx-auto w-full max-w-md depth-3d will-change-transform"
          >
            <div className={cn("relative lg-iso", !reduceMotion && "lg-float")}>
              <div className="lg-glass-strong rounded-3xl p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                    Invoice · extracted
                  </p>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                    completed
                  </span>
                </div>

                <p className="mt-4 font-display text-lg font-semibold text-white">
                  Northwind Traders Pvt Ltd
                </p>
                <p className="text-xs text-white/50">INV-2026-1042 · 26 Sep 2026</p>

                <div className="mt-4 space-y-3">
                  {INVOICE_FIELDS.map((field) => (
                    <div
                      key={field.label}
                      className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.08em] text-white/45">
                          {field.label}
                        </span>
                        <span className="truncate text-sm font-medium text-white">
                          {field.value}
                        </span>
                      </div>
                      <div className="mt-2">
                        <GlowBar value={field.score} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="lg-field mt-4 flex items-center justify-between px-3.5 py-3">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="font-display text-lg font-semibold tabular-nums text-white">
                    ₹12,040.00
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-white/45">
                  <span>subtotal + tax ≈ total · validated</span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                      aria-hidden="true"
                    />
                    processed locally
                  </span>
                </div>
              </div>

              {/* glowing data fields hovering above the glass */}
              <div
                className="lg-field absolute -left-6 top-16 hidden items-center gap-2 px-3 py-2 sm:flex"
                style={{ transform: "translateZ(80px)" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
                <span className="text-[11px] font-medium text-cyan-100">
                  GSTIN ✓ 27AAACA1234A1Z5
                </span>
              </div>
              <div
                className="lg-field lg-field-purple absolute -right-5 bottom-24 hidden items-center gap-2 px-3 py-2 sm:flex"
                style={{ transform: "translateZ(110px)" }}
              >
                <ScanText className="h-3.5 w-3.5 text-violet-200" aria-hidden="true" />
                <span className="text-[11px] font-medium text-violet-100">
                  Tesseract OCR · 0 network calls
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- pipeline */}
      <section id="pipeline" className="relative py-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="lg-glass rounded-3xl p-6 sm:p-9">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80">
                  The pipeline
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
                  Nine stages, all running locally
                </h2>
              </div>
              <p className="max-w-md text-sm text-white/55">
                Every stage has explicit status and friendly error handling — you
                always know exactly where a document is and why something failed.
              </p>
            </div>

            <ol className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
              {PIPELINE_STAGES.map((stage, index) => (
                <motion.li
                  key={stage.label}
                  initial={reduceMotion ? false : "hidden"}
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={fadeUp}
                  whileHover={
                    reduceMotion
                      ? undefined
                      : { y: -6, transition: { duration: 0.2 } }
                  }
                  className="lg-hairline group relative rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-md"
                >
                  <span className="absolute right-2.5 top-2.5 text-[10px] text-white/35">
                    {index + 1}
                  </span>
                  <stage.icon
                    className="h-4 w-4 text-cyan-300"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-xs font-semibold leading-tight text-white">
                    {stage.label}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-tight text-white/50">
                    {stage.hint}
                  </p>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section id="features" className="relative py-16 lg:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300/85">
              What you get
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
              A real document-intelligence stack — minus the cloud
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Not a demo: preprocessing, OCR, classification, extraction,
              confidence scoring and validation are implemented and tested
              end-to-end, with deterministic fallbacks so the app always works.
            </p>
          </div>

          <motion.div
            className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial={reduceMotion ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={container}
          >
            {FEATURES.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                whileHover={
                  reduceMotion
                    ? undefined
                    : { y: -6, transition: { duration: 0.25 } }
                }
                className="lg-glass lg-hairline rounded-2xl p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-400/25 text-cyan-200 shadow-[0_0_22px_rgba(139,92,246,0.35)]">
                  <feature.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {feature.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------- privacy */}
      <section id="privacy" className="relative py-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="lg-glass-strong rounded-3xl p-6 sm:p-10">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <motion.div
                initial={reduceMotion ? false : "hidden"}
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
                variants={fadeUp}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300/85">
                  Privacy model
                </p>
                <h2 className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">
                  ● Local processing is the product
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/60">
                  Privacy here isn't a policy page — it's the architecture. The
                  core workflow is fully functional with the network cable
                  unplugged, and anything external is disabled by default.
                </p>

                <div className="lg-field mt-6 inline-flex items-center gap-3 px-4 py-3">
                  <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 animate-pulse-dot rounded-full bg-cyan-300" />
                  </span>
                  <span className="text-sm font-semibold text-cyan-100">
                    LOCAL PROCESSING
                  </span>
                  <span className="text-xs text-white/55">
                    Your document is processed on this device.
                  </span>
                </div>

                <ul className="mt-7 space-y-3">
                  {PRIVACY_POINTS.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-sm text-white/70"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-wrap gap-3">
                  <CtaLink to="/security" variant="ghost">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Open Security Center
                  </CtaLink>
                  <CtaLink to="/dashboard" variant="ghost">
                    Open workspace
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </CtaLink>
                </div>
              </motion.div>

              <div className="grid gap-3 sm:grid-cols-2">
                {AUDIENCE.map((item) => (
                  <motion.div
                    key={item.label}
                    initial={reduceMotion ? false : "hidden"}
                    whileInView="show"
                    viewport={{ once: true, amount: 0.4 }}
                    variants={fadeUp}
                    whileHover={
                      reduceMotion
                        ? undefined
                        : { y: -4, scale: 1.02, transition: { duration: 0.2 } }
                    }
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-md transition-colors hover:border-violet-300/40 hover:bg-white/10"
                  >
                    <item.icon
                      className="h-4 w-4 shrink-0 text-violet-300"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-white/85">{item.label}</span>
                  </motion.div>
                ))}
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-md sm:col-span-2">
                  <p className="text-xs leading-relaxed text-white/55">
                    MVP focus:{" "}
                    <span className="text-white/90">invoices + receipts</span>.
                    Purchase orders, contracts and forms plug into the same
                    classifier and extractor registries without rework.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- final CTA */}
      <section className="relative py-16 lg:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="lg-glass-strong relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(620px 280px at 50% 0%, rgba(139,92,246,0.32), transparent 70%), radial-gradient(520px 240px at 82% 90%, rgba(34,211,238,0.24), transparent 72%)",
              }}
              aria-hidden="true"
            />
            <motion.div
              className="relative"
              initial={reduceMotion ? false : "hidden"}
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
              variants={fadeUp}
            >
              <h2 className="lg-glow-text font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Private document intelligence.
                <span className="block lg-text-gradient">Powered locally.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
                Drop in an invoice or receipt and watch it become validated,
                searchable, exportable data — without a single byte leaving this
                device.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <CtaLink to="/dashboard">
                  Open the workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CtaLink>
                <CtaLink to="/scan" variant="ghost">
                  <ScanLine className="h-4 w-4" aria-hidden="true" />
                  Upload a document
                </CtaLink>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ footer */}
      <footer className="relative border-t border-white/10 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-white/45 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-300" aria-hidden="true" />
            <span>SecureDoc AI — runs fully offline on this device.</span>
          </div>
          <nav className="flex items-center gap-5" aria-label="Footer">
            <a href="#pipeline" className="transition-colors hover:text-white">
              Pipeline
            </a>
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-white">
              Privacy
            </a>
            <Link to="/dashboard" className="transition-colors hover:text-white">
              Workspace
            </Link>
          </nav>
        </div>
      </footer>

      {/* Subtle corner watermark */}
      <span className="lg-watermark fixed" aria-hidden="true">
        WEALTH
      </span>
    </div>
  );
}
