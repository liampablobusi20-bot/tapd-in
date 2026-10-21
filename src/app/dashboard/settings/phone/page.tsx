import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eyebrow } from "@/components/ui";
import { PhoneSetup } from "../../texts-forms";

const steps = [
  { title: "Open this page on your iPhone", body: "Do the whole setup on the phone itself, in Safari, signed in to Tapd In. It's much easier than going back and forth." },
  { title: "Make your private address", body: "Tap the button in the box below, then tap Copy address. This address is how your phone sends texts to Tapd In. Keep it to yourself." },
  { title: "Start a new automation", body: "Open the Shortcuts app (the blue and pink icon). Tap Automation at the bottom, then the + button, then choose Message." },
  { title: "Choose whose texts to send", body: "Next to Sender, tap Choose and tap the people whose texts count as business, then tap Done. Only the people you pick are ever sent. Texts from everyone else stay on your phone. Leave \"Message Contains\" empty. Only people saved in your Contacts can be picked." },
  { title: "Make it run on its own", body: "On the same screen, choose Run Immediately (not Run After Confirmation). If you see a Notify When Run switch, turn it off. Then tap Next." },
  { title: "Create the shortcut", body: "Tap Create New Shortcut, then search for Get Contents of URL and tap it." },
  { title: "Paste your address", body: "Tap the blue URL word and paste the address you copied. Then tap the small arrow to show more options." },
  { title: "Choose how to send", body: "Set Method to POST and Request Body to Form." },
  { title: "Add who it's from", body: "Tap Add new field and choose Text. In the box called Key, type from. In the Text box, tap Shortcut Input in the row above the keyboard, then tap the blue Shortcut Input pill and choose Sender (or Name if Sender gives something odd). If you can't find these, type the person's name there instead, and make one automation per person." },
  { title: "Add what they said", body: "Add another field, with the Key text. In its Text box, tap Shortcut Input in the row above the keyboard. If the pill offers Content or Message, choose that." },
  { title: "Save it", body: "Tap Done in the top corner. The automation now sends texts from your chosen people to Tapd In whenever they arrive." },
  { title: "Test it", body: "Ask someone you picked to text you something. Within a minute, \"Last text received\" above should change, and the text will appear in your briefing." },
];

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

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const card = "mt-5 rounded-3xl border border-line bg-card p-7 sm:p-8";

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
        ← Settings
      </Link>
      <p className={`${eyebrow} mt-8`}>Texts</p>
      <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">Set up texts on your iPhone</h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
        About ten minutes, once. After that, texts from the people you choose show up in your briefing on their own. Texts from everyone
        else stay on your phone.
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

      <div className={card}>
        <p className="font-medium">Your private address</p>
        <div className="mt-4">
          <PhoneSetup origin={origin} />
        </div>
      </div>

      <ol className="mt-10 flex flex-col gap-4">
        {steps.map((step, i) => (
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
          Only people saved in your Contacts can be picked, so a brand-new number won&apos;t come through at first. When a new client
          texts, open the conversation, tap their number at the top, and choose Add to Contacts. Then open the automation in Shortcuts, tap the
          top section, and add them as a Sender.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">If you see a banner every time a text arrives</h2>
        <p className="mt-3 text-muted">
          Make sure the automation is set to Run Immediately. Then, in your iPhone&apos;s main Settings app, search for Shortcuts, open
          Notifications, and turn off Allow Notifications.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight">If texts stop showing up</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>Open Shortcuts, then Automation, tap the automation, and make sure it says Run Immediately. An iPhone update can switch it back to asking first.</li>
          <li>Low Power Mode and Focus modes can delay or hide automations. Try turning them off to test.</li>
          <li>Texts only come through from the people you picked. To add someone, edit the automation and add them as a Sender.</li>
        </ul>
      </section>
    </div>
  );
}
