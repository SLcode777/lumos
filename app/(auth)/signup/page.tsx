import Link from "next/link"
import { checkRegistrationAllowed } from "@/lib/registration"
import { SignUpForm } from "./signup-form"

type SignUpPageProps = {
  searchParams: Promise<{ token?: string }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { token } = await searchParams
  const result = await checkRegistrationAllowed(token)

  if (!result.allowed) {
    return <RegistrationBlocked reason={result.reason} />
  }

  return <SignUpForm token={token} />
}

function RegistrationBlocked({ reason }: { reason: "closed" | "invite-only-no-token" | "invite-only-invalid-token" }) {
  const messages = {
    closed: {
      title: "Registration is closed",
      description: "This Lumos instance is not accepting new sign-ups right now.",
    },
    "invite-only-no-token": {
      title: "This Lumos instance is invite-only",
      description: "Ask your administrator for an invitation link, then return here using that URL.",
    },
    "invite-only-invalid-token": {
      title: "Invitation link is invalid",
      description:
        "This invitation link is invalid, expired, or has already been used. Ask your administrator for a fresh one.",
    },
  } as const

  const { title, description } = messages[reason]

  return (
    <div className="flex flex-col gap-6 text-center">
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
