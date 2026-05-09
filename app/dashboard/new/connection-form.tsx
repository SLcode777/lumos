"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  createConnectionAction,
  testConnectionAction,
  type TestConnectionState,
  type CreateConnectionState,
} from "./actions"

export function ConnectionForm() {
  const [state, formAction, pending] = useActionState<CreateConnectionState, FormData>(createConnectionAction, {})
  const [testState, testFormAction, testPending] = useActionState<TestConnectionState, FormData>(
    testConnectionAction,
    null
  )
  const formRef = useRef<HTMLFormElement>(null)
  const [mode, setMode] = useState<"url" | "fields">("url")
  const [sslEnabled, setSslEnabled] = useState(true)
  const [isReadOnly, setIsReadOnly] = useState(true)

  const fieldErrors = state?.fieldErrors ?? {}

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Hidden controls reflecting React state into the FormData payload */}
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="sslEnabled" value={sslEnabled ? "on" : "off"} />
      <input type="hidden" name="isReadOnly" value={isReadOnly ? "on" : "off"} />

      {/* Connection name */}
      <div className="space-y-2">
        <Label htmlFor="name">Connection name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          placeholder="Local dev DB"
          aria-invalid={fieldErrors.name ? true : undefined}
        />
        {fieldErrors.name ? <FieldError message={fieldErrors.name} /> : null}
      </div>

      {/* Connection details — tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as "url" | "fields")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-2 pt-4">
          <Label htmlFor="connectionString">Connection string</Label>
          <Textarea
            id="connectionString"
            name="connectionString"
            rows={3}
            placeholder="postgresql://user:password@host:5432/database"
            className="font-mono text-sm"
            aria-invalid={fieldErrors.connectionString ? true : undefined}
          />
          {fieldErrors.connectionString ? <FieldError message={fieldErrors.connectionString} /> : null}
        </TabsContent>

        <TabsContent value="fields" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                name="host"
                placeholder="db.example.com"
                aria-invalid={fieldErrors.host ? true : undefined}
              />
              {fieldErrors.host ? <FieldError message={fieldErrors.host} /> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                name="port"
                type="number"
                min={1}
                max={65535}
                defaultValue={5432}
                aria-invalid={fieldErrors.port ? true : undefined}
              />
              {fieldErrors.port ? <FieldError message={fieldErrors.port} /> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database">Database</Label>
            <Input
              id="database"
              name="database"
              placeholder="app"
              aria-invalid={fieldErrors.database ? true : undefined}
            />
            {fieldErrors.database ? <FieldError message={fieldErrors.database} /> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Input id="user" name="user" autoComplete="off" aria-invalid={fieldErrors.user ? true : undefined} />
              {fieldErrors.user ? <FieldError message={fieldErrors.user} /> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="off" />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Toggles */}
      <div className="space-y-4 rounded-lg border p-4">
        <ToggleRow
          id="ssl"
          label="SSL enabled"
          description="Encrypt traffic between Lumos and the database. Strongly recommended for any non-localhost target."
          checked={sslEnabled}
          onCheckedChange={setSslEnabled}
        />
        <ToggleRow
          id="readonly"
          label="Read-only"
          description="Lumos will refuse to run mutating queries through this connection."
          checked={isReadOnly}
          onCheckedChange={setIsReadOnly}
        />
      </div>

      {/* Test result */}
      {testState ? <TestResult state={testState} /> : null}

      {/* Form-level error */}
      {state?.formError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.formError}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={testPending || pending}
          onClick={() => {
            if (!formRef.current) return
            const fd = new FormData(formRef.current)
            startTransition(() => {
              testFormAction(fd)
            })
          }}
        >
          {testPending ? "Testing…" : "Test connection"}
        </Button>
        <Button type="submit" disabled={pending || testPending}>
          {pending ? "Saving…" : "Save connection"}
        </Button>
      </div>
    </form>
  )
}

function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-destructive">{message}</p>
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function TestResult({ state }: { state: NonNullable<TestConnectionState> }) {
  if (state.ok) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Connection successful.</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      <XCircle className="h-4 w-4 shrink-0" />
      <span>{state.error}</span>
    </div>
  )
}