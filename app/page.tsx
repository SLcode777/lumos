import Link from "next/link"
import { Eye, FileText, Code, Pencil, Sparkles, LogIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"

const REPO_URL = "https://github.com/SLcode777/lumos"

const features = [
  {
    icon: Eye,
    title: "Browse with ease",
    description: "Explore tables, relationships, and data in a clean interface.",
  },
  {
    icon: Pencil,
    title: "Inline editing",
    description: "Edit records directly in the table view with smart type handling.",
  },
  {
    icon: Sparkles,
    title: "Instant schema discovery",
    description: "Automatically understands your database structure.",
  },
]

export default function Page() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between p-6">
        <span className="font-serif text-2xl tracking-tight">Lumos</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="icon">
            <Link href={REPO_URL} target="_blank" rel="noreferrer" aria-label="View source on GitHub">
              <Code />
            </Link>
          </Button>
          <Button asChild size="sm" className="ml-2">
            <Link href="/signin">
              <LogIn /> Sign in
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-xl flex-col gap-10">
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="mb-6 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              🚧 Pre-alpha — work in progress
            </span>
            <div className="flex flex-row items-center">
              <Image src={"/logo.png"} alt="logo" width={100} height={100} className="-mx-10 -mt-18" />
              <h1 className="font-serif text-6xl leading-none tracking-tight sm:text-7xl">Lumos</h1>
            </div>
            <p className="text-base text-balance text-muted-foreground sm:text-lg">
              A web-based PostgreSQL browser. Connect, explore, and edit any Postgres database from your browser —
              simple, elegant, pleasant to use.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="rounded-full bg-muted p-2">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href={REPO_URL} target="_blank" rel="noreferrer">
                <Code /> View on GitHub
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${REPO_URL}/blob/master/PRD.md`} target="_blank" rel="noreferrer">
                <FileText /> Read the PRD
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="flex flex-col items-center justify-between gap-2 p-6 text-xs text-muted-foreground sm:flex-row">
        <span>
          MIT License ·{" "}
          <Link href={`${REPO_URL}/blob/master/LICENSE`} target="_blank" rel="noreferrer" className="hover:underline">
            see license
          </Link>
        </span>
        <span className="font-mono">
          Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">d</kbd> to toggle theme
        </span>
      </footer>
    </div>
  )
}
