"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { generateInvitationAction } from "./actions"

type Phase = { kind: "form" } | { kind: "success"; url: string; expiresAt: string } | { kind: "error"; message: string }

export function GenerateInvitationDialog() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: "form" })
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  function reset() {
    setPhase({ kind: "form" })
    setCopied(false)
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>Generate invitation link</Button>
      </DialogTrigger>
      <DialogContent>
        {phase.kind === "form" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setPending(true)
              const result = await generateInvitationAction(new FormData(e.currentTarget))
              setPending(false)
              if (result.ok) {
                setPhase({ kind: "success", url: result.signupUrl, expiresAt: result.expiresAt })
              } else {
                setPhase({ kind: "error", message: result.error })
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>New invitation</DialogTitle>
              <DialogDescription>
                The link will be shown <strong>once</strong>. Copy it before closing this dialog.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Pre-fill email (optional)</Label>
                <Input id="email" name="email" type="email" placeholder="alice@example.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ttlDays">Expiration (days, optional)</Label>
                <Input id="ttlDays" name="ttlDays" type="number" min={1} placeholder="7" />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {phase.kind === "success" && (
          <>
            <DialogHeader>
              <DialogTitle>Invitation link</DialogTitle>
              <DialogDescription>
                ⚠️ This link is shown only now. Copy it and transmit it out-of-band (Signal, password manager, etc.). It
                expires {new Date(phase.expiresAt).toLocaleString()}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 py-4">
              <Input readOnly value={phase.url} className="font-mono text-xs" />
              <Button onClick={() => copyToClipboard(phase.url)}>{copied ? "Copied!" : "Copy"}</Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {phase.kind === "error" && (
          <>
            <DialogHeader>
              <DialogTitle>Could not generate invitation</DialogTitle>
              <DialogDescription>{phase.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={reset}>Try again</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
