"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { UserListItem } from "@/lib/users"

type Props = {
  user: UserListItem | null
  onClose: () => void
  onConfirm: (id: string) => void
}

export function DeleteUserDialog({ user, onClose, onConfirm }: Props) {
  return (
    <Dialog open={user !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{user?.email}</strong> and cascade to all their saved connections,
            shared accesses, and table layouts. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => user && onConfirm(user.id)}>
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
