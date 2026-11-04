import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eyebrow } from "@/components/ui";
import { PhoneSetup } from "../../texts-forms";
import { getConfig } from "@/lib/inbox/config-store";

const steps = [
  { title: "Open this page on your iPhone", body: "Do the whole setup on the phone itself, in Safari, signed in to Tapd In." },
  { title: "Make your private address", body: "Tap the button in the first box below, then tap Copy address. This address is how your phone sends texts to Tapd In. Keep it to yourself." },
  { title: "Start a new automation", body: "Open the Shortcuts app (the blue and pink icon). Tap Automation at the bottom, then the + button, then choose Message." },
  { title: "Choose whose texts to send", body: "Next to Sender, tap Choose and tap the people whose texts count as business, then tap Done. Only the people you pick are ever sent. Texts from everyone else stay on your phone. Only people saved in your Contacts can be picked." },
  { title: "Make it run on its own", body: "On the same screen, choose Run Immediately (not Run After Confirmation). Look for a Notify When Run switch and turn it off. A small banner from Shortcuts may still appear when a text arrives, and that's normal. Then tap Next." },
  { title: "Create the shortcut", body: "Tap Create New Shortcut, then search for Get Contents of URL and tap it." },
  { title: "Paste your address", body: "Tap the blue URL word and paste the address you copied. Then tap the small arrow to show more options." },
  { title: "Choose how to send", body: "Set Method to POST and Request Body to Form." },
  { title: "Add who it's from", body: "Tap Add new field and choose Text. In the box called Key, type from. In the Text box, tap Shortcut Input in the row above the keyboard, then tap the blue Shortcut Input pill and choose Sender." },
  { title: "Add what they said", body: "Add another field with the Key text. In its Text box, tap Shortcut Input in the row above the keyboard, then tap the blue pill and choose Content." },
  { title: "Save it", body: "Tap Done in the top corner. From now on, texts from the people you picked arrive in your briefing on their own." },
  { title: "Test it", body: "Ask someone you picked to text you something. Within a minute, \"Last text received\" above should change and the text will appear in your briefing. Tap Name this number under it to give them a name." },
];

// Easy mode: the same automation, but with nobody picked as a Sender. Tapd In keeps only the people on the
// list in Settings, so adding someone later never means touching the phone again.
const easySteps = steps.map((step) =>
  step.title === "Choose whose texts to send"
    ? {
        title: "Choose Any Sender, and add a space",
        body: "Set Sender to Any Sender. Shortcuts won't let you leave Message Contains empty, so type a single space there. Tapd In keeps only the people on the list in Settings and immediately discards every other text. One catch: a space only matches texts that contain a space, so a one-word text like \"Yes\" is skipped. See the note at the bottom to cover those.",
      }
    : step.title === "Test it"
      ? {
          title: "Test it",
          body: "Add yourself or a friend to the list in Settings, then ask them to text you. Within a minute \"Last text received\" above should change and the text will appear in your briefing. A text from someone not on your list will not appear anywhere. That is the point.",
        }
      : step
);

export default async function PhoneGuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: last } = await supabase
    .from("inbox_messages")
    .select("sender_name, received_at")
    .eq("source", "sms")
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const config = await getConfig(user.id);
  const easy = config.textsMode === "easy";
  const guide = easy ? easySteps : steps;
  const { data: keyRows } = await supabase
    .from("inbox_text_keys")
    .select("last_used_at")
    .is("revoked_at", null)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .limit(1);
  const lastCheckIn = keyRows?.[0]?.last_used_at ?? null;
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const card = "mt-5 rounded-3xl border border-line bg-card p-7 sm:p-8";

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
          ← Settings
        </Link>
        <div className="flex items-center gap-5 text-sm">
          <Link href="/guide/iphone" className="text-muted underline underline-offset-4 hover:text-ink">
            One-page cheat sheet
          </Link>
          <Link href="/guide#texts" className="text-muted underline underline-offset-4 hover:text-ink">
            Full setup guide
          </Link>
        </div>
      </div>
      <p className={`${eyebrow} mt-8`}>Texts</p>
      <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">Set up texts on your iPhone</h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        {easy
          ? "About ten minutes, once. After that, you add people in Tapd In and their texts show up on their own. Nothing else is kept."
          : "About ten minutes, once. After that, texts from the people you choose show up in your briefing on their own. Texts from everyone else stay on your phone."}
      </p>
      <p className="mt-4 max-w-xl rounded-2xl bg-alert-soft px-5 py-3 text-sm text-alert">
        This guide is new. If a step doesn&apos;t match what you see on your iPhone, tell us which one so we can fix it.
      </p>

      <div className={card}>
        <p className="font-medium">Last text received</p>
        <p className="mt-1 text-sm text-muted">
          {last
            ? `${last.sender_name ?? "Someone"} · ${new Date(last.received_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" })}`
            : "None yet. This will update the first time a text comes through."}
        </p>
      </div>

      {easy && (
        <div className={card}>
          <p className="font-medium">Phone last checked in</p>
          <p className="mt-1 text-sm text-muted">
            {lastCheckIn
              ? new Date(lastCheckIn).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" })
              : "Not yet. This updates when your phone sends its first text."}
            {" "}This shows your phone is working even when the text was from someone not on your list, which Tapd In doesn&apos;t keep.
          </p>
        </div>
      )}

      <div className={card}>
        <p className="font-medium">Your private address</p>
        <div className="mt-4">
          <PhoneSetup origin={origin} />
        </div>
      </div>

      <ol className="mt-10 flex flex-col gap-4">
        {guide.map((step, i) => (
          <li key={step.title} className="flex gap-5 rounded-3xl border border-line bg-card p-6">
            <span className="font-display text-4xl italic text-accent/40">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="font-semibold tracking-tight">{step.title}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">When someone new texts you</h2>
        <p className="mt-3 text-muted">
          {easy
            ? "Add them to the list in Settings, with their name and number. That's all: their next text will show up in your briefing, and nothing on your phone needs to change. Texts from anyone not on the list are discarded."
            : "Save them in your Contacts, then open the automation in Shortcuts, tap the top section, and add them as a Sender. After their first text arrives, tap Name this number in your briefing. Texts only come through from the people picked in the automation."}
        </p>
      </section>

      <details className="mt-12">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Experimental: a one-tap shortcut</summary>
        <div className="mt-4 rounded-3xl border border-line bg-card p-6">
          <p className="max-w-md text-sm leading-relaxed text-muted">
            We&apos;re testing a ready-made shortcut that lets you manage the list inside Tapd In instead of Shortcuts. It isn&apos;t reliable
            yet, so use the steps above for now.
          </p>
          <a href="/TapdIn.shortcut" className="mt-4 inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-ink/30">
            Add the experimental shortcut
          </a>
        </div>
      </details>

      {easy && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Catching one-word texts</h2>
          <p className="mt-3 text-muted">
            Message Contains only runs for texts that contain what you typed, so a single space misses one-word replies such as &quot;Yes&quot; or &quot;Ok&quot;. To
            catch those too, make one or two more automations exactly like this one, each with Sender set to Any Sender and a different single letter in
            Message Contains, such as <strong className="font-medium text-ink">e</strong> and <strong className="font-medium text-ink">o</strong>. If two of them run for the same
            text, Tapd In keeps it only once. You may see a banner for each one.
          </p>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">If you see a banner when a text arrives</h2>
        <p className="mt-3 text-muted">
          That&apos;s Shortcuts telling you it ran, and it&apos;s harmless. To hide it, turn off Notify When Run in the automation. Depending on
          your iPhone&apos;s software you can also search Settings for Shortcuts and turn off its notifications. It can&apos;t always be hidden
          completely.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">If texts stop showing up</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>Open Shortcuts, then Automation, tap the automation, and make sure it says Run Immediately. An iPhone update can switch it back to asking first.</li>
          <li>Low Power Mode and Focus modes can delay or hide automations. Try turning them off to test.</li>
          <li>Texts only come through from the people picked as Senders in the automation. Open it and check the person is listed.</li>
        </ul>
      </section>
    </div>
  );
}
