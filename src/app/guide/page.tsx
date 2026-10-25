import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary, btnSecondary, eyebrow, Wordmark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Setup guide",
  description: "Step by step: connect Outlook, choose your topics, and add your texts.",
};

// Screenshots taken on an iPhone go in /public/guide and are listed here by step
// number. A step without an entry shows its words only.
const IPHONE_SHOTS: Record<string, { src: string; alt: string }> = {};

function Figure({ src, alt, caption, width = 640 }: { src: string; alt: string; caption: string; width?: number }) {
  return (
    <figure className="mt-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        className="w-full max-w-xl rounded-2xl border border-line shadow-[0_1px_2px_rgba(27,26,23,0.04),0_20px_40px_-24px_rgba(27,26,23,0.25)]"
      />
      <figcaption className="mt-2.5 text-xs text-faint">{caption}</figcaption>
    </figure>
  );
}

function Step({ n, title, children, shot }: { n: string; title: string; children: React.ReactNode; shot?: string }) {
  const image = shot ? IPHONE_SHOTS[shot] : undefined;
  return (
    <li className="flex gap-5 rounded-3xl border border-line bg-card p-6 sm:p-7">
      <span className="w-12 flex-none font-display text-4xl italic text-accent/40">{n}</span>
      <div className="min-w-0">
        <p className="font-semibold tracking-tight">{title}</p>
        <div className="mt-1.5 text-[15px] leading-relaxed text-muted">{children}</div>
        {image && <Figure src={image.src} alt={image.alt} caption="On your iPhone" width={360} />}
      </div>
    </li>
  );
}

function Callout({ children, tone = "note" }: { children: React.ReactNode; tone?: "note" | "warn" }) {
  return (
    <p
      className={`mt-5 rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
        tone === "warn" ? "bg-alert-soft text-alert" : "bg-accent-soft text-accent"
      }`}
    >
      {children}
    </p>
  );
}

function Part({ id, label, title, children }: { id: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-20 scroll-mt-8">
      <p className={eyebrow}>{label}</p>
      <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const toc = [
  ["start", "Before you begin"],
  ["outlook", "Connect Outlook"],
  ["topics", "Choose your topics"],
  ["texts", "Add your texts"],
  ["briefing", "Read your briefing"],
  ["help", "If something goes wrong"],
];

export default function GuidePage() {
  const p = "max-w-xl text-[15px] leading-relaxed text-muted";
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/login" className="text-muted transition-colors hover:text-ink">
            Log in
          </Link>
          <Link href="/demo" className={btnSecondary}>
            See a sample
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-28 pt-8 sm:pt-14">
        <p className={eyebrow}>Setup guide</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">From sign-up to your first briefing.</h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Connect Outlook, choose your topics, and add the texts that matter. Plan on about 20 minutes, and you only do it once.
        </p>

        <nav className="mt-10 flex flex-wrap gap-2">
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-line bg-card px-4 py-2 text-sm text-muted transition-colors hover:text-ink">
              {label}
            </a>
          ))}
        </nav>

        <Part id="start" label="Part 0" title="Before you begin">
          <p className={p}>You need three things.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
            <li>
              <strong className="font-semibold text-ink">A Tapd In account that has been switched on.</strong> Request access at{" "}
              <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
                tapdin.tech/signup
              </Link>
              , confirm your email, and we&apos;ll switch your inbox on. Until then you&apos;ll see a short &quot;You&apos;re on the list&quot; page.
            </li>
            <li>
              <strong className="font-semibold text-ink">An Outlook or Microsoft 365 email account</strong>, for email.
            </li>
            <li>
              <strong className="font-semibold text-ink">An iPhone</strong>, if you want texts included. Apple doesn&apos;t let apps read texts, so this part
              runs through a built-in iPhone feature, set up once.
            </li>
          </ul>
          <Callout>
            Email and texts are separate. You can connect Outlook now and add texts later, and the briefing works either way.
          </Callout>
        </Part>

        <Part id="outlook" label="Part 1" title="Connect Outlook">
          <p className={p}>This takes about two minutes. Tapd In gets read-only access: it can read your inbox but can never send, delete, or change anything.</p>
          <ol className="mt-6 flex flex-col gap-4">
            <Step n="01" title="Open Settings">
              Sign in at tapdin.tech, open the menu, and choose <strong className="font-semibold text-ink">Settings</strong>. The first section is{" "}
              <strong className="font-semibold text-ink">Connect your email</strong>.
            </Step>
            <Step n="02" title="Connect Outlook / Microsoft 365">
              Tap the black <strong className="font-semibold text-ink">Connect Outlook / Microsoft 365</strong> button. Microsoft&apos;s own sign-in page opens.
            </Step>
            <Step n="03" title="Sign in and approve">
              Sign in with your work or Outlook account. Microsoft lists what Tapd In is asking for: to read your mail, and to keep access until you
              disconnect. Tap <strong className="font-semibold text-ink">Accept</strong>.
            </Step>
            <Step n="04" title="Check it connected">
              You return to Settings with a green message, and your email address is listed as <strong className="font-semibold text-ink">Connected</strong>. Your
              last few days of mail start to appear in your briefing within a couple of minutes, and new mail is checked every two minutes.
            </Step>
          </ol>
          <Figure
            src="/guide/connect-outlook.png"
            alt="The Connect your email section of Tapd In Settings, showing a connected Outlook account"
            caption="What Settings looks like once Outlook is connected (sample data)."
          />
          <Callout tone="warn">
            If Microsoft says your organization needs an administrator&apos;s approval, Tapd In shows a link to send to your IT team. They approve it once for the
            whole company, and then you connect again. If that isn&apos;t possible, you can forward email to your private Tapd In address instead (shown just below
            on the same page).
          </Callout>
          <p className="mt-5 text-sm text-faint">To disconnect, tap Disconnect next to your account. That deletes the stored sign-in, so nothing more can be read.</p>
        </Part>

        <Part id="topics" label="Part 2" title="Choose your topics">
          <p className={p}>
            Topics are the headings your briefing is sorted under, like Clients, Team, or Vendors. Give each one a short description so messages land in the
            right place.
          </p>
          <ol className="mt-6 flex flex-col gap-4">
            <Step n="01" title="Find Topics in Settings">
              Scroll down Settings to <strong className="font-semibold text-ink">Topics</strong>.
            </Step>
            <Step n="02" title="Add three to five topics">
              Type a name, then a few words on what belongs there, and tap <strong className="font-semibold text-ink">Add topic</strong>. For example:{" "}
              <em>Clients, customers and prospects; Team, staff and scheduling; Vendors, suppliers and invoices.</em>
            </Step>
            <Step n="03" title="Adjust any time">
              Remove a topic with <strong className="font-semibold text-ink">Remove</strong>. Messages that don&apos;t fit anywhere appear under <em>Other</em>.
            </Step>
          </ol>
          <Figure src="/guide/topics.png" alt="The Topics section of Tapd In Settings" caption="Topics with descriptions (sample data)." />
        </Part>

        <Part id="texts" label="Part 3" title="Add your texts">
          <p className={p}>
            You choose the people whose texts count as business. Texts from everyone else stay on your phone and never reach Tapd In. Do this part on your
            iPhone.
          </p>
          <Callout>
            Allow about ten minutes. Anyone you add later takes about a minute: add them as a sender (step 4 below), and give them a name in Tapd In.
          </Callout>

          <h3 className="mt-10 text-lg font-semibold tracking-tight">A. Add your people in Tapd In</h3>
          <p className={`${p} mt-2`}>
            In Settings, under <strong className="font-semibold text-ink">Text messages</strong>, add each person&apos;s name and the phone number they text you from. Your
            iPhone will show them by name in your briefing.
          </p>
          <Figure
            src="/guide/people-list.png"
            alt="The People whose texts count list in Tapd In Settings"
            caption="Adding the people whose texts count (sample data)."
          />

          <h3 className="mt-12 text-lg font-semibold tracking-tight">B. Make your private address</h3>
          <p className={`${p} mt-2`}>
            On your iPhone, open <strong className="font-semibold text-ink">Settings → Set up texts on your iPhone</strong> in Tapd In, tap{" "}
            <strong className="font-semibold text-ink">Make my private address</strong>, then <strong className="font-semibold text-ink">Copy address</strong>. It&apos;s shown only
            once, and it&apos;s how your phone sends texts to your account, so keep it to yourself.
          </p>

          <h3 className="mt-12 text-lg font-semibold tracking-tight">C. Build the automation on your iPhone</h3>
          <p className={`${p} mt-2`}>Open the Shortcuts app (blue and pink icon) and follow these steps in order.</p>
          <ol className="mt-6 flex flex-col gap-4">
            <Step n="01" title="Start a new automation" shot="1">
              Tap <strong className="font-semibold text-ink">Automation</strong> at the bottom, then the <strong className="font-semibold text-ink">+</strong> button, then
              choose <strong className="font-semibold text-ink">Message</strong>.
            </Step>
            <Step n="02" title="Choose whose texts to send" shot="2">
              Next to <strong className="font-semibold text-ink">Sender</strong>, tap <strong className="font-semibold text-ink">Choose</strong> and tap the people from
              your list. Tap <strong className="font-semibold text-ink">Done</strong>. Only people saved in your Contacts can be picked.
            </Step>
            <Step n="03" title="Make it run on its own" shot="3">
              On the same screen, choose <strong className="font-semibold text-ink">Run Immediately</strong>, not Run After Confirmation. If you see{" "}
              <strong className="font-semibold text-ink">Notify When Run</strong>, turn it off. Tap <strong className="font-semibold text-ink">Next</strong>.
            </Step>
            <Step n="04" title="Create the shortcut" shot="4">
              Tap <strong className="font-semibold text-ink">Create New Shortcut</strong>, search for{" "}
              <strong className="font-semibold text-ink">Get Contents of URL</strong>, and tap it.
            </Step>
            <Step n="05" title="Paste your address" shot="5">
              Tap the blue <strong className="font-semibold text-ink">URL</strong> word and paste the address you copied. Then tap the small arrow to show more options.
            </Step>
            <Step n="06" title="Choose how to send" shot="6">
              Set <strong className="font-semibold text-ink">Method</strong> to <strong className="font-semibold text-ink">POST</strong>, and{" "}
              <strong className="font-semibold text-ink">Request Body</strong> to <strong className="font-semibold text-ink">Form</strong>.
            </Step>
            <Step n="07" title="Add who it's from" shot="7">
              Tap <strong className="font-semibold text-ink">Add new field</strong> and choose <strong className="font-semibold text-ink">Text</strong>. In the box called{" "}
              <strong className="font-semibold text-ink">Key</strong>, type <code className="rounded bg-paper px-1.5 py-0.5 text-ink">from</code>. Tap in the Text box, tap{" "}
              <strong className="font-semibold text-ink">Shortcut Input</strong> in the row above the keyboard, then tap the blue pill and choose{" "}
              <strong className="font-semibold text-ink">Sender</strong>.
            </Step>
            <Step n="08" title="Add what they said" shot="8">
              Add another field. Key: <code className="rounded bg-paper px-1.5 py-0.5 text-ink">text</code>. In its Text box, tap{" "}
              <strong className="font-semibold text-ink">Shortcut Input</strong>, then tap the blue pill and choose{" "}
              <strong className="font-semibold text-ink">Content</strong>.
            </Step>
            <Step n="09" title="Save it" shot="9">
              Tap <strong className="font-semibold text-ink">Done</strong> in the top corner. You should see exactly one automation in your list.
            </Step>
            <Step n="10" title="Test it">
              Ask someone from your list to text you. Within a minute, the text appears in your briefing marked <em>Text</em>. The{" "}
              <strong className="font-semibold text-ink">Last text received</strong> line on the &quot;Set up texts&quot; page also updates.
            </Step>
          </ol>

          <h3 className="mt-12 text-lg font-semibold tracking-tight">D. When someone new texts you</h3>
          <p className={`${p} mt-2`}>
            Save them in your Contacts. Open the automation in Shortcuts, tap the top section, and add them as a Sender. Then add their name and number in Tapd In. Their
            first text arrives as a phone number, and tapping <strong className="font-semibold text-ink">Name this number</strong> under it labels it from then on.
          </p>
        </Part>

        <Part id="briefing" label="Part 4" title="Read your briefing">
          <p className={p}>Open Tapd In any time, and you also get the same week by email every Monday morning.</p>
          <Figure src="/guide/briefing.png" alt="A sample Tapd In briefing" caption="A briefing with sample data." width={500} />
          <ul className="mt-6 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
            <li>
              <strong className="font-semibold text-ink">Needs your attention</strong> comes first: anything urgent, like a deadline or a request for a decision.
            </li>
            <li>
              Everything else sits under your <strong className="font-semibold text-ink">topics</strong>, each message boiled down to a line.
            </li>
            <li>
              <strong className="font-semibold text-ink">Reply</strong> opens a new email or text to that person in your own mail app or Messages.
            </li>
            <li>
              <strong className="font-semibold text-ink">Not business</strong> deletes that message from Tapd In.
            </li>
            <li>
              For a text, <strong className="font-semibold text-ink">Summarize the conversation</strong> combines recent texts from that person into a short summary, only
              when you ask.
            </li>
            <li>
              <strong className="font-semibold text-ink">Email me this week</strong> sends the weekly email right now, so you can see how it looks.
            </li>
          </ul>
        </Part>

        <Part id="help" label="Part 5" title="If something goes wrong">
          <div className="divide-y divide-line rounded-3xl border border-line bg-card px-6 sm:px-8">
            {[
              ["Microsoft says it needs administrator approval", "Send your IT team the link shown in Settings, or forward email to your private address instead."],
              ["Mail isn't appearing", "Tapd In checks every two minutes. Make sure Settings says Connected. If it says Needs to be reconnected, tap Reconnect."],
              ["Texts aren't arriving", "In Shortcuts, open the automation and check it says Run Immediately and that the person is listed as a Sender. Low Power Mode and Focus modes can delay automations, so try turning them off."],
              ["Texts show a phone number, not a name", "Tap Name this number under the text, or add the person with their number in Settings."],
              ["A banner appears on every text", "Make sure the automation says Run Immediately. Then in your iPhone's Settings app, search for Shortcuts, open Notifications, and turn off Allow Notifications."],
              ["Texts arrive twice", "You probably have two automations. In Shortcuts, delete all but one."],
              ["Texts stopped after an iPhone update", "Open the automation and check it still says Run Immediately. Updates can switch it back to asking first."],
            ].map(([problem, fix]) => (
              <div key={problem} className="py-5">
                <p className="font-medium">{problem}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{fix}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-muted">
            Still stuck? Email{" "}
            <a href="mailto:liampablobusi20@gmail.com" className="font-medium text-ink underline underline-offset-4">
              liampablobusi20@gmail.com
            </a>{" "}
            and say which step you&apos;re on.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={btnPrimary}>
              Request access
            </Link>
            <Link href="/privacy" className={btnSecondary}>
              How your data is handled
            </Link>
          </div>
        </Part>
      </main>
    </div>
  );
}
