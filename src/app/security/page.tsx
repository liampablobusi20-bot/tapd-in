import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary, eyebrow, Wordmark } from "@/components/ui";

export const metadata: Metadata = {
  title: "How we handle your data",
  description: "What Tapd In reads, what it keeps, who processes it, and how you stay in control.",
};

const CONTACT = "liampablobusi20@gmail.com";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      <div className="mt-5 flex flex-col gap-4 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const processors: [string, string][] = [
  ["Anthropic", "Writes each short summary. Under its commercial API terms, content sent to it is not used to train its models, and it may keep it for a limited time under its own policies."],
  ["Supabase", "Stores your summaries and settings in a database."],
  ["Vercel", "Hosts the app and runs the scheduled checks."],
  ["Resend", "Receives email you choose to forward, and sends your Monday briefing."],
  ["Sentry", "Error monitoring. Reports are stripped of message content, addresses, and keys before they leave."],
  ["Microsoft", "Handles your Outlook sign-in. We never see your Microsoft password."],
];

export default function SecurityPage() {
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Wordmark />
        <Link href="/signup" className={btnPrimary}>
          Request access
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-28 pt-8 sm:pt-14">
        <p className={eyebrow}>Privacy and security</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">How we handle your data.</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Tapd In reads your email and the texts you choose, writes a one-line summary of each, and then deletes the original. Here is exactly
          what that means, in plain words.
        </p>

        <Block title="What we read">
          <List
            items={[
              <>
                <strong className="font-medium text-ink">Your Outlook inbox, read-only.</strong> We can&apos;t send, delete, or change anything in your
                mailbox. We don&apos;t read other folders, attachments, or contacts.
              </>,
              <>
                <strong className="font-medium text-ink">When you replied.</strong> The date and thread of your recent Sent Items, never their text, so a
                message you already answered doesn&apos;t show as waiting.
              </>,
              <>
                <strong className="font-medium text-ink">Texts from people you pick.</strong> Your iPhone sends only those people&apos;s texts. Everyone
                else&apos;s stay on your phone.
              </>,
              <>
                <strong className="font-medium text-ink">Your calendar, only if you turn on meeting briefs.</strong> Titles, times, and attendees of
                the next day or so. We don&apos;t read notes or attachments, and we don&apos;t store any of it.
              </>,
            ]}
          />
        </Block>

        <Block title="What we keep, and what we delete">
          <List
            items={[
              <>
                <strong className="font-medium text-ink">Deleted within minutes:</strong> the full text and the subject line of every message, as soon
                as its summary is written.
              </>,
              <>
                <strong className="font-medium text-ink">Kept:</strong> the one-line summary, its topic, whether it looks urgent or waiting on you, anything
                promised, who it was from, and the date. Plus your topics, your people list, and an encrypted sign-in token for Outlook.
              </>,
              <>
                <strong className="font-medium text-ink">Deleted automatically:</strong> summaries are removed after 180 days unless you choose 90
                days or 1 year in Settings.
              </>,
              <>
                <strong className="font-medium text-ink">Never:</strong> sold, used for advertising, or used to train AI models.
              </>,
            ]}
          />
        </Block>

        <Block title="Who can see it">
          <p>
            Only you. Each account&apos;s data is separated in the database, so one customer can&apos;t reach another&apos;s. Tapd In never sends messages
            or texts on your behalf: a reply or nudge opens in your own email or messages app, for you to edit and send.
          </p>
          <p>
            The person who runs Tapd In has technical access to the database, as anyone running a service does. We don&apos;t look at your
            summaries unless you ask for help with a problem, and our status page shows only counts and dates, never content.
          </p>
        </Block>

        <Block title="Who processes it">
          <ul className="divide-y divide-line rounded-3xl border border-line bg-card px-6 sm:px-7">
            {processors.map(([name, what]) => (
              <li key={name} className="py-4">
                <p className="font-medium text-ink">{name}</p>
                <p className="mt-0.5 text-sm">{what}</p>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="How it's protected">
          <List
            items={[
              "Your data is encrypted in transit and at rest by our hosting providers.",
              "Outlook sign-in tokens get an extra layer of encryption in our own code, with the key stored apart from the database.",
              "Phone keys are stored only as one-way hashes, and you can revoke one at any time.",
              "Two-step sign-in protects the accounts that host our code, our database, and the app itself.",
              "You can turn on two-step sign-in for your own account too. A 6-digit code from your phone is then required, and the database itself refuses to hand over your data without it.",
              "A record of sign-ins, connection changes, and settings changes is kept for you to review in Settings, so you can spot anything that isn't you.",
              "Error reports are scrubbed of message content and secrets before they are sent.",
            ]}
          />
        </Block>

        <Block title="You stay in control">
          <List
            items={[
              <>
                <strong className="font-medium text-ink">Not business</strong> deletes any single message.
              </>,
              <>
                <strong className="font-medium text-ink">Delete all my data</strong> in Settings removes everything we hold about your messages, texts,
                people, and connections in one step.
              </>,
              "Disconnect Outlook any time in Settings, and turn meeting briefs off separately. You can also remove Tapd In at myapps.microsoft.com.",
            ]}
          />
        </Block>

        <Block title="What we don't claim">
          <List
            items={[
              "Summaries are written by an AI and can be wrong. For anything important, check the original.",
              "Tapd In is an early product. It has not been through an independent security audit, and it holds no formal certification yet.",
              "Texts depend on an automation you set up on your iPhone, and a small Shortcuts banner can appear when one arrives.",
            ]}
          />
        </Block>

        <div className="mt-16 rounded-3xl bg-accent px-8 py-10 text-paper sm:px-12">
          <p className="font-display text-3xl leading-tight tracking-tight">Questions about your data?</p>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper/75">
            Ask us anything, or request deletion at any time. We reply personally.
          </p>
          <a
            href={`mailto:${CONTACT}`}
            className="mt-6 inline-flex rounded-full bg-paper px-6 py-3 text-sm font-medium text-accent transition-opacity hover:opacity-90"
          >
            {CONTACT}
          </a>
        </div>

        <p className="mt-10 text-sm text-faint">
          Read the full{" "}
          <a href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/terms" className="underline underline-offset-4">
            Terms of Service
          </a>
          .
        </p>
      </main>
    </div>
  );
}
