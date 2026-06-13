import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";

export default function HomeScreen() {
  const count = useAppStore((s) => s.count);
  const inc = useAppStore((s) => s.inc);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="font-semibold tracking-tight">App UX Prototype</div>
          <nav className="flex gap-4 text-sm text-muted">
            <a href="#" className="hover:text-foreground">Docs</a>
            <a href="#" className="hover:text-foreground">Pricing</a>
            <a href="#" className="hover:text-foreground">Log in</a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          This is your scaffold.
        </h1>
        <p className="mt-4 text-lg text-muted max-w-2xl">
          The prototype starts here. Edit{" "}
          <code className="font-mono text-sm bg-surface px-1.5 py-0.5 rounded">src/screens/home/index.tsx</code>{" "}
          to bring the design alive — Tailwind, shadcn primitives, Zustand, TanStack Query / Router / Table are wired and ready.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={inc}>Clicked {count} times</Button>
          <Button variant="outline">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Theme tokens</CardTitle>
            </CardHeader>
            <CardContent>
              Colors, fonts, radius and density live in{" "}
              <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">src/styles/tokens.css</code>. Editing them reskins every screen via Tailwind&apos;s semantic classes.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Device shell</CardTitle>
            </CardHeader>
            <CardContent>
              Visit <a href="/__ued/shell" className="text-accent underline">/__ued/shell</a> to preview inside a phone / pad / desktop frame.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inspect</CardTitle>
            </CardHeader>
            <CardContent>
              In the shell, press <kbd className="font-mono text-xs">I</kbd> or click the magnifier to point at any element and leave an edit.
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
