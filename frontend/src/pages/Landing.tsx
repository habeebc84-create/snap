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
import { ConfidenceBar } from "../components/status";
import { cn } from "../lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

function CtaLink({
  to,
  children,
  variant = "primary",
  className,
}: {
  to: string;
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost-light";
  className?: string;
}) {
  const styles = {
    primary:
      "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
    outline:
      "border border-border bg-card/70 text-foreground hover:bg-accent/60",
    "ghost-light":
      "border border-white/15 bg-white/5 text-white hover:bg-white/10",
  }[variant];
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-medium transition-all active:scale-[0.98]",
        styles,
        className,
      )}
    >
      {children}
    </Link>
  );
}

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
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [7, -7]), {
    stiffness: 170,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-9, 9]), {
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
    <div className="min-h-screen bg-background">
      {/* ------------------------------------------------------------ Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-blue-600 text-white shadow-soft">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold">
                SecureDoc AI
              </span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Private by design
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Landing">
            <a href="#pipeline" className="transition-colors hover:text-foreground">
              Pipeline
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <CtaLink to="/dashboard" className="hidden h-9 px-4 sm:inline-flex">
              Open workspace
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CtaLink>
            <Link
              to="/dashboard"
              className="rounded-lg border border-border/70 bg-card/60 p-2 sm:hidden"
              aria-label="Open workspace"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(900px 420px at 15% 0%, hsl(172 66% 30% / 0.16), transparent 65%), radial-gradient(700px 380px at 90% 20%, hsl(172 40% 40% / 0.12), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-20">
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            variants={container}
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 animate-pulse-dot rounded-full bg-emerald-500" />
              </span>
              LOCAL PROCESSING — on this device
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.05]"
            >
              Your documents stay on your device.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              SecureDoc AI turns invoices and receipts into structured data with
              on-device OCR, classification, extraction and validation — then
              lets you correct anything before it hits your local database.
              <span className="mt-2 block text-foreground">
                No cloud upload. No API keys. No telemetry.
              </span>
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <CtaLink to="/dashboard">
                Open the workspace
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </CtaLink>
              <CtaLink to="/scan" variant="outline">
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                Scan your first document
              </CtaLink>
            </motion.div>

            <motion.dl
              variants={fadeUp}
              className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-border/60 pt-6"
            >
              {[
                { value: "0", label: "bytes leave the device" },
                { value: "9", label: "local pipeline stages" },
                { value: "4", label: "export formats" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-display text-2xl font-semibold">{stat.value}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>

          {/* Preview: document ⇄ extracted fields */}
          <motion.div
            ref={tiltRef}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            onPointerMove={handleTiltMove}
            onPointerLeave={handleTiltLeave}
            style={
              reduceMotion
                ? undefined
                : { rotateX, rotateY, transformPerspective: 1200 }
            }
            className="depth-3d relative will-change-transform"
          >
            <motion.div
              className="glass depth-3d rounded-2xl p-4 sm:p-5"
              animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
              transition={
                reduceMotion
                  ? { duration: 0.5 }
                  : {
                      duration: 7,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1.2,
                    }
              }
            >
              <div className="flex items-center justify-between">
                <p className="field-label">Extracted fields · invoice</p>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  completed
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { label: "Invoice number", value: "INV-2026-1042", score: 0.97 },
                  { label: "Vendor", value: "Northwind Traders Pvt Ltd", score: 0.92 },
                  { label: "GSTIN", value: "27AAACA1234A1Z5", score: 0.89 },
                  { label: "Invoice date", value: "26 Sep 2026", score: 0.95 },
                ].map((field) => (
                  <div
                    key={field.label}
                    className="rounded-xl border border-border/60 bg-background/60 px-3.5 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        {field.label}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {field.value}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ConfidenceBar value={field.score} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-display text-lg font-semibold tabular-nums">
                  ₹12,040.00
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>subtotal + tax ≈ total · validated</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  processed locally
                </span>
              </div>
            </motion.div>

            <div
              className="absolute -bottom-4 -left-3 hidden rounded-xl border border-border/60 bg-card/90 px-3 py-2 text-xs shadow-soft sm:block"
              style={{ transform: "translateZ(45px)" }}
            >
              <span className="font-medium">Tesseract OCR</span>
              <span className="ml-2 text-muted-foreground">· 0 network calls</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Pipeline */}
      <section id="pipeline" className="border-y border-border/60 bg-card/40 py-14">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="field-label">The pipeline</p>
              <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
                Nine stages, all running locally
              </h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
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
                    : {
                        y: -6,
                        rotateX: 8,
                        transformPerspective: 900,
                        transition: { duration: 0.2 },
                      }
                }
                className="depth-3d group relative rounded-xl border border-border/60 bg-background/70 p-3 transition-colors duration-200 hover:border-emerald-500/40 hover:shadow-soft"
              >
                <span className="absolute right-2.5 top-2.5 text-[10px] text-muted-foreground/70">
                  {index + 1}
                </span>
                <stage.icon
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <p className="mt-2 text-xs font-semibold leading-tight">
                  {stage.label}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  {stage.hint}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------- Features */}
      <section id="features" className="py-16 lg:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="field-label">What you get</p>
            <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
              A real document-intelligence stack — minus the cloud
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
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
                    : {
                        y: -6,
                        rotateX: 4,
                        transformPerspective: 1000,
                        transition: { duration: 0.25 },
                      }
                }
                className="glass depth-3d group rounded-2xl p-5 transition-colors hover:border-emerald-500/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-emerald-500/15 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                  <feature.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Privacy */}
      <section id="privacy" className="bg-sidebar py-16 text-white lg:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            variants={fadeUp}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
              Privacy model
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
              ● Local processing is the product
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/65">
              Privacy here isn't a policy page — it's the architecture. The
              core workflow is fully functional with the network cable
              unplugged, and anything external is disabled by default.
            </p>

            <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 animate-pulse-dot rounded-full bg-emerald-400" />
              </span>
              <span className="text-sm font-semibold text-emerald-300">
                LOCAL PROCESSING
              </span>
              <span className="text-xs text-white/60">
                Your document is being processed on this device.
              </span>
            </div>

            <ul className="mt-7 space-y-3">
              {PRIVACY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-white/75">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink to="/security" variant="ghost-light">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Open Security Center
              </CtaLink>
              <CtaLink to="/dashboard" variant="ghost-light">
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
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 transition-colors hover:bg-white/10"
              >
                <item.icon className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span className="text-sm text-white/85">{item.label}</span>
              </motion.div>
            ))}
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 sm:col-span-2">
              <p className="text-xs leading-relaxed text-white/60">
                MVP focus: <span className="text-white/90">invoices + receipts</span>.
                Purchase orders, contracts and forms plug into the same
                classifier and extractor registries without rework.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Final CTA */}
      <section className="py-16 lg:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="glass-strong relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(600px 260px at 50% 0%, hsl(172 66% 30% / 0.18), transparent 70%)",
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
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Private document intelligence.
                <span className="block text-emerald-700 dark:text-emerald-400">
                  Powered locally.
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Drop in an invoice or receipt and watch it become validated,
                searchable, exportable data — without a single byte leaving
                this device.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <CtaLink to="/dashboard">
                  Open the workspace
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CtaLink>
                <CtaLink to="/scan" variant="outline">
                  <ScanLine className="h-4 w-4" aria-hidden="true" />
                  Upload a document
                </CtaLink>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>SecureDoc AI — runs fully offline on this device.</span>
          </div>
          <nav className="flex items-center gap-5" aria-label="Footer">
            <a href="#pipeline" className="transition-colors hover:text-foreground">
              Pipeline
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <Link to="/dashboard" className="transition-colors hover:text-foreground">
              Workspace
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
