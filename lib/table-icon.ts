import {
  Book,
  Bookmark,
  Box,
  Building,
  Calendar,
  CheckCircle2,
  Code2,
  FileText,
  Globe,
  Image,
  Key,
  LayoutGrid,
  Lock,
  Mail,
  MailPlus,
  MapPin,
  MessageSquare,
  Music,
  Newspaper,
  Palette,
  Plug,
  Receipt,
  Settings,
  ShoppingCart,
  Star,
  StickyNote,
  Table as TableIcon,
  Tag,
  Users,
  Video,
  Workflow,
  type LucideIcon,
} from "lucide-react"

/**
 * Curated mapping of regex patterns to lucide icons. The first match wins,
 * so order matters: put more specific patterns above broader ones.
 *
 * The dictionary is biased toward English table names common in SaaS schemas.
 * For non-English schemas (or domain-specific naming), unmatched tables
 * fall back to a generic table icon. A future enhancement could let users
 * override per-table via the existing TableLayout model.
 */
// Lookbehind `(?<![a-z])` ensures short keywords match only at word starts (or
// after `_`), avoiding substring collisions like `profile` → `file` →
// FileText. We don't add a lookahead because most plurals (`-s`, `-es`) and
// suffixes (`_uploads`) are fine to match through.
const ICON_MAP: Array<[RegExp, LucideIcon]> = [
  // Content / pages — `blog` must win before the broader `log` match below.
  [/blog|article|^posts?$|_posts?$/i, Newspaper],
  [/bookmark/i, Bookmark], //                                  before /book/ to avoid collision
  [/notebook|^books?$|_books?$/i, Book], //                    anchored so `bookkeeper` doesn't match
  [/notes?(?![a-z])/i, StickyNote], //                         trailing anchor so `notification` doesn't match
  [/snippet/i, Code2],
  [/(?<![a-z])(?:video|movie|clip)/i, Video],
  [/(?<![a-z])(?:music|audio|song|track|album)/i, Music],
  [/palette|^themes?$|_themes?$/i, Palette],
  [/domain|hostname|tld/i, Globe], //                          unanchored: `subdomain` should match too
  [/layout|template/i, LayoutGrid],

  // Specific status / process patterns first (so `email_verification` lands
  // on CheckCircle2 instead of Mail, etc.).
  [/verif|validation/i, CheckCircle2],
  [/migration|migrate/i, Workflow],

  // Communications.
  [/email|inbox|notification/i, Mail], //                      keep before /invit/ to claim "notification"
  [/invit/i, MailPlus],
  [/connection|^conns?$/i, Plug],

  // Auth / config.
  [/setting|config|preference/i, Settings],
  [/token|api[_-]?key/i, Key],
  [/(?<![a-z])session/i, Lock],

  // Domain-specific.
  [/invoice|receipt|bill|payment|charge|refund/i, Receipt],
  [/review|rating|feedback/i, Star],
  [/message|chat|comment|thread/i, MessageSquare],
  [/event|audit|history|activity|(?<![a-z])log/i, Calendar],
  [/(?<![a-z])file|document|attachment|asset/i, FileText],
  [/image|photo|picture|media/i, Image],
  [/address|location|venue/i, MapPin],

  // Categorical / structural.
  [/categor|(?<![a-z])tag|label/i, Tag],
  [/shop|store|merchant|company|organization|workspace|team/i, Building],

  // Commerce. `order` comes before `product` so `order_items` → cart, not box.
  [/order|purchase|transaction|sale|(?<![a-z])cart/i, ShoppingCart],
  [/product|(?<![a-z])item|sku|inventory/i, Box],

  // Users — broadest pattern, matched last so `user_logs` still goes to Calendar.
  [/user|customer|account|profile|member|people|person/i, Users],
]

/**
 * Returns the most appropriate lucide icon for a given table name based on
 * a regex-keyed dictionary of common SaaS naming patterns. Falls back to a
 * generic table icon when nothing matches.
 *
 * The input is normalized to snake_case + lowercase before matching, so
 * camelCase identifiers (e.g. `TableLayout`, `ConnectionAccess`) are handled
 * the same way as snake_case ones.
 */
export function getTableIcon(tableName: string): LucideIcon {
  const normalized = normalizeTableName(tableName)
  for (const [pattern, icon] of ICON_MAP) {
    if (pattern.test(normalized)) return icon
  }
  return TableIcon
}

function normalizeTableName(name: string): string {
  return name.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()
}
