/**
 * Design-system tests (RED → GREEN cycle)
 * Covers: cn() utility, Providers mount, QueryClientProvider + ThemeProvider availability
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Providers } from "@/app/providers";
import { cn } from "@/lib/utils";

// ── cn() utility ─────────────────────────────────────────────────────────────

describe("cn()", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges conflicting Tailwind classes — last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("filters falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("joins non-conflicting classes", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });
});

// ── Providers ─────────────────────────────────────────────────────────────────

function QueryClientConsumer() {
  const client = useQueryClient();
  return <div data-testid="ok">{client ? "has-client" : "no-client"}</div>;
}

function ThemeConsumer() {
  const { theme } = useTheme();
  return <div data-testid="theme">{theme ?? "none"}</div>;
}

describe("Providers", () => {
  it("mounts without error", () => {
    const { unmount } = render(
      <Providers>
        <span data-testid="child">hello</span>
      </Providers>
    );
    expect(screen.getByTestId("child")).toBeDefined();
    unmount();
  });

  it("exposes QueryClient context to descendants", () => {
    render(
      <Providers>
        <QueryClientConsumer />
      </Providers>
    );
    expect(screen.getByTestId("ok").textContent).toBe("has-client");
  });

  it("provides ThemeProvider context so useTheme returns a defined theme", () => {
    render(
      <Providers>
        <ThemeConsumer />
      </Providers>
    );
    // Without ThemeProvider, useTheme returns undefined; with it, it returns the defaultTheme
    expect(screen.getByTestId("theme").textContent).not.toBe("none");
  });
});
