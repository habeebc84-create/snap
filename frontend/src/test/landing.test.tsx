import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";
import { ToastProvider } from "../components/toast";

/** Every request fails with a friendly 404 — pages must still render. */
function mockFetch() {
  const fetchMock = vi.fn(async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: { code: "not_found", message: "Not found" } }),
    text: async () =>
      JSON.stringify({ error: { code: "not_found", message: "Not found" } }),
    headers: new Headers({ "content-type": "application/json" }),
  } as Response));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function renderApp(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Landing page", () => {
  it("renders the hero at /", async () => {
    mockFetch();
    renderApp("/");

    expect(
      await screen.findByRole("heading", {
        name: /Your documents stay on your device/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /Open the workspace/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/LOCAL PROCESSING/i).length).toBeGreaterThan(0);
  });

  it("navigates from the landing CTA into the workspace", async () => {
    mockFetch();
    const user = userEvent.setup();
    renderApp("/");

    const cta = (await screen.findAllByRole("link", {
      name: /Open the workspace/i,
    }))[0];
    await user.click(cta);

    // Dashboard (lazy chunk) renders its local-processing subtitle.
    expect(
      await screen.findByText(/Your documents are processed locally/i),
    ).toBeInTheDocument();
  });

  it("renders the dashboard directly at /dashboard", async () => {
    mockFetch();
    renderApp("/dashboard");

    expect(
      await screen.findByText(/Your documents are processed locally/i),
    ).toBeInTheDocument();
  });

  it("shows the not-found page for unknown routes", async () => {
    mockFetch();
    renderApp("/definitely-not-a-page");

    expect(
      await screen.findByRole("heading", { name: /Page not found/i }),
    ).toBeInTheDocument();
  });
});
