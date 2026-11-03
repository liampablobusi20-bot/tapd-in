import type { Metadata } from "next";
import Link from "next/link";
import { eyebrow, Wordmark } from "@/components/ui";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "iPhone texts cheat sheet",
  description: "One page: the exact taps to send business texts from an iPhone to Tapd In.",
};

const steps: [string, string][] = [
  ["Open Tapd In on the iPhone", "In Safari, signed in. Go to Settings → Set up texts on your iPhone."],
  ["Make and copy your private address", "Tap the button, then Copy address. Keep it private."],
  ["Shortcuts app → Automation → + → Message", "Blue and pink icon. Automation tab at the bottom."],
  ["Sender → Choose", "Tick every business contact (clients, crew, vendors). Tap Done. Only people saved in Contacts can be picked."],
  ["Run Immediately", "Not Run After Confirmation. Turn Notify When Run off. Tap Next."],
  ["Create New Shortcut → Get Contents of URL", "Search for it and tap it."],
  ["Tap the blue URL → paste your address", "Then tap the small arrow to show more options."],
  ["Method: POST. Request Body: Form.", ""],
  ["Add new field → Text. Key: from", "In its Text box: tap Shortcut Input, tap the blue pill, choose Sender."],
  ["Add new field → Text. Key: text", "In its Text box: tap Shortcut Input, tap the blue pill, choose Content. Tap Done."],
];

export default function IphoneCheatSheetPage() {
  return (
    <div className="min-h-svh print:min-h-0">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6 print:hidden">
        <Wordmark />
        <Link href="/guide" className="text-sm text-muted transition-colors hover:text-ink">
          Full setup guide
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-4 print:max-w-none print:px-0 print:pb-0 print:pt-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>iPhone cheat sheet</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl print:text-3xl">Send business texts to Tapd In</h1>
          </div>
          <div className="print:hidden">
            <PrintButton />
          </div>
        </div>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted print:mt-2 print:text-sm">
          About ten minutes, once. Only texts from the people you tick are ever sent. Everyone else&apos;s stay on your phone. Works the same with one
          line or two (dual SIM), because it picks by who texted you, not which line they texted.
        </p>

        <ol className="mt-8 grid gap-3 print:mt-4 print:gap-1.5">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-line bg-card px-5 py-3.5 print:break-inside-avoid print:rounded-lg print:px-3 print:py-1.5">
              <span className="w-7 flex-none font-display text-2xl italic text-accent/50 print:text-lg">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold tracking-tight print:text-sm">{title}</p>
                {body && <p className="mt-0.5 text-sm leading-relaxed text-muted print:text-xs">{body}</p>}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 print:mt-3 print:gap-2">
          <section className="rounded-2xl border border-line bg-card px-5 py-4 print:break-inside-avoid print:rounded-lg print:px-3 print:py-2">
            <h2 className="text-sm font-semibold tracking-tight">Test it</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted print:text-xs">
              Ask someone you ticked to text you. Within a minute &quot;Last text received&quot; changes in Tapd In, and the text shows in your
              briefing. Tap <em>Name this number</em> to give them a name.
            </p>
          </section>
          <section className="rounded-2xl border border-line bg-card px-5 py-4 print:break-inside-avoid print:rounded-lg print:px-3 print:py-2">
            <h2 className="text-sm font-semibold tracking-tight">Adding someone later</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted print:text-xs">
              Save them in Contacts, then Shortcuts → Automation → tap yours → add them as a Sender. Easiest: add everyone you can think of now.
            </p>
          </section>
          <section className="rounded-2xl border border-line bg-card px-5 py-4 sm:col-span-2 print:break-inside-avoid print:rounded-lg print:px-3 print:py-2">
            <h2 className="text-sm font-semibold tracking-tight">Easy mode (optional)</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted print:text-xs">
              Prefer not to edit the automation when you add someone? In Tapd In choose <em>Settings → How texts are sent → Easy mode</em>, and in step 4 leave
              Sender empty. Your phone then sends every text, and Tapd In immediately discards any that aren&apos;t from the people on your list. Add someone in
              Settings and it works straight away. The catch: your iPhone may show a small Shortcuts banner for every text, including personal ones, and it
              can&apos;t always be hidden. If that gets annoying, switch back to private mode.
            </p>
          </section>
          <section className="rounded-2xl border border-line bg-card px-5 py-4 sm:col-span-2 print:break-inside-avoid print:rounded-lg print:px-3 print:py-2">
            <h2 className="text-sm font-semibold tracking-tight">If texts stop showing up</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted print:text-xs">
              <li>Shortcuts → Automation → your automation: it must say <strong className="font-medium text-ink">Run Immediately</strong>. An iPhone update can switch it back.</li>
              <li>Low Power Mode and Focus can delay or hide automations. Turn them off to test.</li>
              <li>Make sure the person is ticked as a Sender. A small Shortcuts banner on each text is normal and harmless.</li>
            </ul>
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-faint print:mt-3">Tapd In · tapdin.tech/guide/iphone</p>
      </main>
    </div>
  );
}
