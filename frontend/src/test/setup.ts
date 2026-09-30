import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom lacks matchMedia
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom lacks IntersectionObserver (used by framer-motion whileInView)
if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element): void {
      const entry = {
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        time: Date.now(),
        boundingClientRect: target.getBoundingClientRect(),
      } as unknown as IntersectionObserverEntry;
      this.callback([entry], this);
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
    IntersectionObserverStub;
}

// jsdom lacks ResizeObserver (used by Recharts' ResponsiveContainer)
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
}

// jsdom lacks scrollTo
window.scrollTo = (() => undefined) as typeof window.scrollTo;
