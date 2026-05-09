import {
  Book,
  Bookmark,
  Box,
  Building,
  Calendar,
  CheckCircle2,
  Code2,
  Globe,
  LayoutGrid,
  Lock,
  Mail,
  MailPlus,
  Music,
  Palette,
  Plug,
  Receipt,
  ShoppingCart,
  Star,
  StickyNote,
  Table as TableIcon,
  Tag,
  Users,
  Video,
  Workflow,
} from "lucide-react"
import { describe, expect, it } from "vitest"

import { getTableIcon } from "@/lib/table-icon"

describe("getTableIcon", () => {
  it("matches common SaaS table names", () => {
    expect(getTableIcon("users")).toBe(Users)
    expect(getTableIcon("user")).toBe(Users)
    expect(getTableIcon("customers")).toBe(Users)
    expect(getTableIcon("accounts")).toBe(Users)
    expect(getTableIcon("products")).toBe(Box)
    expect(getTableIcon("orders")).toBe(ShoppingCart)
    expect(getTableIcon("reviews")).toBe(Star)
    expect(getTableIcon("categories")).toBe(Tag)
    expect(getTableIcon("shops")).toBe(Building)
    expect(getTableIcon("invoices")).toBe(Receipt)
    expect(getTableIcon("audit_logs")).toBe(Calendar)
    expect(getTableIcon("sessions")).toBe(Lock)
    expect(getTableIcon("notifications")).toBe(Mail)
  })

  it("matches case-insensitively", () => {
    expect(getTableIcon("USERS")).toBe(Users)
    expect(getTableIcon("Customers")).toBe(Users)
    expect(getTableIcon("ProductS")).toBe(Box)
  })

  it("matches snake_case and prefixed/suffixed names", () => {
    expect(getTableIcon("app_users")).toBe(Users)
    expect(getTableIcon("user_profiles")).toBe(Users)
    expect(getTableIcon("product_items")).toBe(Box)
    expect(getTableIcon("payment_receipts")).toBe(Receipt)
  })

  it("falls back to the generic TableIcon for unmatched names", () => {
    expect(getTableIcon("widgets")).toBe(TableIcon)
    expect(getTableIcon("foo_bar_baz")).toBe(TableIcon)
    expect(getTableIcon("")).toBe(TableIcon)
  })

  it("respects first-match-wins ordering", () => {
    // 'auth_log' could plausibly match both /auth/ (Lock) and /log/ (Calendar).
    // The order in ICON_MAP puts Calendar (events/log) above auth-only patterns,
    // so this is a documented winner. Lock our expected behavior in.
    expect(getTableIcon("auth_log")).toBe(Calendar)
  })

  it("matches content-related table names", () => {
    expect(getTableIcon("bookmarks")).toBe(Bookmark)
    expect(getTableIcon("user_bookmarks")).toBe(Bookmark)
    expect(getTableIcon("books")).toBe(Book)
    expect(getTableIcon("notebooks")).toBe(Book)
    expect(getTableIcon("notes")).toBe(StickyNote)
    expect(getTableIcon("user_notes")).toBe(StickyNote)
    expect(getTableIcon("snippets")).toBe(Code2)
    expect(getTableIcon("code_snippets")).toBe(Code2)
  })

  it("matches media table names", () => {
    expect(getTableIcon("videos")).toBe(Video)
    expect(getTableIcon("video_clips")).toBe(Video)
    expect(getTableIcon("music")).toBe(Music)
    expect(getTableIcon("audio_tracks")).toBe(Music)
    expect(getTableIcon("song_albums")).toBe(Music)
  })

  it("matches design / web table names", () => {
    expect(getTableIcon("palettes")).toBe(Palette)
    expect(getTableIcon("color_palettes")).toBe(Palette)
    expect(getTableIcon("themes")).toBe(Palette)
    expect(getTableIcon("dark_theme")).toBe(Palette)
    expect(getTableIcon("domains")).toBe(Globe)
    expect(getTableIcon("subdomains")).toBe(Globe)
    expect(getTableIcon("hostnames")).toBe(Globe)
    expect(getTableIcon("layouts")).toBe(LayoutGrid)
    expect(getTableIcon("page_templates")).toBe(LayoutGrid)
  })

  it("matches Lumos's own domain (connection / invitation / layout)", () => {
    expect(getTableIcon("Connection")).toBe(Plug)
    expect(getTableIcon("ConnectionAccess")).toBe(Plug)
    expect(getTableIcon("Invitation")).toBe(MailPlus)
    expect(getTableIcon("invites")).toBe(MailPlus)
    expect(getTableIcon("TableLayout")).toBe(LayoutGrid)
  })

  it("does not let `note` swallow `notification` (Mail wins)", () => {
    expect(getTableIcon("notifications")).toBe(Mail)
    expect(getTableIcon("user_notifications")).toBe(Mail)
  })

  it("does not let `book` swallow `bookmark` (Bookmark wins)", () => {
    expect(getTableIcon("bookmarks")).toBe(Bookmark)
    expect(getTableIcon("page_bookmarks")).toBe(Bookmark)
  })

  it("matches verification / validation as a check icon", () => {
    expect(getTableIcon("verification")).toBe(CheckCircle2)
    expect(getTableIcon("verifications")).toBe(CheckCircle2)
    expect(getTableIcon("email_verification")).toBe(CheckCircle2)
    expect(getTableIcon("validations")).toBe(CheckCircle2)
  })

  it("matches migrations as a workflow icon", () => {
    expect(getTableIcon("migrations")).toBe(Workflow)
    expect(getTableIcon("schema_migrations")).toBe(Workflow)
    expect(getTableIcon("_prisma_migrations")).toBe(Workflow)
  })
})
