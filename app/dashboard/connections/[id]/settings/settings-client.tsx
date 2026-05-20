"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ConnectionForm, type ConnectionFormInitialValues } from "@/components/connection-form"

import { deleteConnectionAction, updateConnectionAction } from "./actions"

type Props = {
  connectionId: string
  initialValues: ConnectionFormInitialValues
}

export function SettingsClient({ connectionId, initialValues }: Props) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, startDeleteTransition] = useTransition()

  // Bind the connectionId into the action so the form gets a 2-arg action
  // (prevState, formData) compatible with useActionState.
  const boundUpdateAction = updateConnectionAction.bind(null, connectionId)

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteConnectionAction(connectionId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Connection deleted.")
      setDeleteOpen(false)
      // Server side already revalidated /dashboard. Push, don't replace —
      // back button should still feel natural.
      router.push("/dashboard")
    })
  }

  return (
    <>
      <ConnectionForm
        mode="edit"
        action={boundUpdateAction}
        initialValues={initialValues}
        trailing={
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={deletePending}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        }
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{initialValues.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the connection and revoke access for anyone you&apos;ve shared it with. Saved
              table layouts for this connection are also removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // AlertDialogAction closes the dialog by default — we don't
                // want that, because the action is async and might fail.
                // Prevent the default close, run the action, and only close
                // on success (via setDeleteOpen(false) in handleDelete).
                e.preventDefault()
                handleDelete()
              }}
              disabled={deletePending}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              {deletePending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
