"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { CheckCircle2, Eye, EyeOff, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { testConnectionAction, type TestConnectionState } from "@/app/dashboard/new/actions"
import type { ConnectionFormState } from "@/lib/connections"

/**
 * Replace the password portion of a postgres URL with bullets for display.
 * Captures everything between the first ":" after user info and the "@".
 * If the string isn't a recognizable postgres URL (or has no password),
 * returns it unchanged.
 */
const PASSWORD_IN_URL = /^(postgres(?:ql)?:\/\/[^:@\/]+):([^@]+)(@)/
const PASSWORD_MASK = "••••••••"

function maskPasswordInUrl(s: string): string {
  return s.replace(PASSWORD_IN_URL, `$1:${PASSWORD_MASK}$3`)
}

/**
 * Initial values used to pre-fill the form in edit mode. Mirrors the Neon /
 * Supabase / RDS console UX: the authenticated owner is entitled to see what
 * she configured. Credentials still live encrypted at rest in the DB; the
 * page decrypts them server-side before passing them down.
 */
export type ConnectionFormInitialValues = {
  name: string
  sslEnabled: boolean
  isReadOnly: boolean
  connectionString: string
  host: string
  port: number
  database: string
  user: string
  password: string
}

type Props = {
  mode: "create" | "edit"
  /** Server action invoked on submit. Different per mode (create vs update). */
  action: (prev: ConnectionFormState, fd: FormData) => Promise<ConnectionFormState>
  /** Required in "edit" mode, ignored in "create". */
  initialValues?: ConnectionFormInitialValues
  /** Label of the submit button. Defaults differ per mode. */
  submitLabel?: string
  /** Optional extra slot rendered next to the submit row — used by edit page for the Delete button. */
  trailing?: React.ReactNode
}

export function ConnectionForm({ mode, action, initialValues, submitLabel, trailing }: Props) {
  const [state, formAction, pending] = useActionState<ConnectionFormState, FormData>(action, {})
  const [testState, testFormAction, testPending] = useActionState<TestConnectionState, FormData>(
    testConnectionAction,
    null
  )
  const formRef = useRef<HTMLFormElement>(null)

  // In edit mode we default to the "url" tab too — the user, if she chooses
  // to rotate credentials, will paste a single URL. The fields tab stays
  // available if she prefers to rebuild from parts.
  const [formMode, setFormMode] = useState<"url" | "fields">("url")
  const [sslEnabled, setSslEnabled] = useState(initialValues?.sslEnabled ?? true)
  const [isReadOnly, setIsReadOnly] = useState(initialValues?.isReadOnly ?? true)

  // Real connection string the form will submit. The Textarea below displays
  // either this value or its masked variant depending on `showUrlPassword`.
  // A hidden input mirrors this state into the FormData so the action always
  // receives the real (unmasked) string regardless of toggle state.
  const [urlValue, setUrlValue] = useState(initialValues?.connectionString ?? "")
  const [showUrlPassword, setShowUrlPassword] = useState(false)
  const [showFieldsPassword, setShowFieldsPassword] = useState(false)

  const fieldErrors = state?.fieldErrors ?? {}

  const isEdit = mode === "edit"
  const finalSubmitLabel = submitLabel ?? (isEdit ? "Save changes" : "Save connection")

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Hidden controls reflecting React state into the FormData payload.
          The shadcn Switch is a Radix <button>, not an <input type="checkbox">,
          so it doesn't participate in the form's FormData natively. */}
      <input type="hidden" name="mode" value={formMode} />
      <input type="hidden" name="sslEnabled" value={sslEnabled ? "on" : "off"} />
      <input type="hidden" name="isReadOnly" value={isReadOnly ? "on" : "off"} />
      {/* Real connection string sent to the action — kept in sync with the
          controlled state, never the masked rendering of the textarea. */}
      <input type="hidden" name="connectionString" value={urlValue} />

      {/* Connection name */}
      <div className="space-y-2">
        <Label htmlFor="name">Connection name</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          placeholder="Local dev DB"
          defaultValue={initialValues?.name ?? ""}
          aria-invalid={fieldErrors.name ? true : undefined}
        />
        {fieldErrors.name ? <FieldError message={fieldErrors.name} /> : null}
      </div>

      {/* Connection details — tabs */}
      <Tabs value={formMode} onValueChange={(v) => setFormMode(v as "url" | "fields")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-2 pt-4">
          <Label htmlFor="connectionString">Connection string</Label>
          <div className="relative">
            <Textarea
              id="connectionString"
              // No `name` here — the hidden input above carries the real value.
              // Keeps the textarea free to display the masked variant without
              // leaking it into FormData.
              rows={3}
              placeholder="postgresql://user:password@host:5432/database"
              value={showUrlPassword ? urlValue : maskPasswordInUrl(urlValue)}
              onChange={(e) => setUrlValue(e.target.value)}
              readOnly={!showUrlPassword}
              className="pr-10 font-mono text-sm"
              aria-invalid={fieldErrors.connectionString ? true : undefined}
            />
            <Button
              type="button"
              variant="card"
              size="icon-sm"
              className="absolute top-2 right-2 text-muted-foreground"
              aria-label={showUrlPassword ? "Hide password" : "Show password"}
              onClick={() => setShowUrlPassword((v) => !v)}
            >
              {showUrlPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
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
                defaultValue={initialValues?.host ?? ""}
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
                defaultValue={initialValues?.port ?? 5432}
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
              defaultValue={initialValues?.database ?? ""}
              aria-invalid={fieldErrors.database ? true : undefined}
            />
            {fieldErrors.database ? <FieldError message={fieldErrors.database} /> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Input
                id="user"
                name="user"
                autoComplete="off"
                defaultValue={initialValues?.user ?? ""}
                aria-invalid={fieldErrors.user ? true : undefined}
              />
              {fieldErrors.user ? <FieldError message={fieldErrors.user} /> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showFieldsPassword ? "text" : "password"}
                  autoComplete="off"
                  defaultValue={initialValues?.password ?? ""}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="card"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                  aria-label={showFieldsPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowFieldsPassword((v) => !v)}
                >
                  {showFieldsPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
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

      <div className="flex items-center justify-end gap-2">
        {/* Trailing slot — used by edit page to render the Delete button on the left. */}
        {trailing ? <div className="mr-auto">{trailing}</div> : null}

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
          {pending ? "Saving…" : finalSubmitLabel}
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
