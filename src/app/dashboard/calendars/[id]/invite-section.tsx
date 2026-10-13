"use client";

import { useActionState, useState, useTransition } from "react";
import { createGuestLink, revokeGuestLink } from "@/lib/actions/guest-links";
import { createGroup, deleteGroup, setLinkGroup } from "@/lib/actions/guest-groups";

type GuestLink = {
  id: string;
  token: string;
  permission: "view" | "comment";
  contact_name: string | null;
  notify_via: "email" | "sms" | null;
  group_id: string | null;
  created_at: string;
};

type Group = { id: string; name: string };

type Contact = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const selectClass =
  "w-full appearance-none rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-9 text-sm text-zinc-700 shadow-sm transition-colors hover:border-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5";

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5";

function LinkRow({
  link,
  calendarId,
  groups,
}: {
  link: GuestLink;
  calendarId: string;
  groups: Group[];
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/c/${link.token}`
      : "";

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
          {(link.contact_name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900">
            {link.contact_name || "Unnamed guest"}
          </p>
          <p className="text-xs text-zinc-500">
            {link.permission === "view" ? "View only" : "Can comment"} ·{" "}
            {link.notify_via === "email"
              ? "Notifies by email"
              : link.notify_via === "sms"
                ? "Notifies by text"
                : "No notifications"}{" "}
            · Created {new Date(link.created_at).toLocaleDateString("en-US")}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {groups.length > 0 && (
          <select
            aria-label="Group"
            value={link.group_id ?? ""}
            disabled={pending}
            onChange={(e) =>
              startTransition(
                async () =>
                  await setLinkGroup(link.id, calendarId, e.target.value || null)
              )
            }
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:border-zinc-300 disabled:opacity-50"
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          onClick={() =>
            startTransition(async () => await revokeGuestLink(link.id, calendarId))
          }
          disabled={pending}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          {pending ? "Revoking…" : "Revoke"}
        </button>
      </div>
    </li>
  );
}

export function InviteSection({
  calendarId,
  links,
  groups,
  contacts,
}: {
  calendarId: string;
  links: GuestLink[];
  groups: Group[];
  contacts: Contact[];
}) {
  const [state, formAction, pending] = useActionState(
    createGuestLink.bind(null, calendarId),
    undefined
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [groupPending, startGroupTransition] = useTransition();

  function applyContact(id: string) {
    const contact = contacts.find((c) => c.id === id);
    if (!contact) return;
    setName(contact.name ?? "");
    setPhone(contact.phone ?? "");
    setEmail(contact.email ?? "");
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-zinc-900">Invite people</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Anyone with the link can view — no account or app needed on their end.
      </p>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-zinc-900">Groups</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Put guests in groups (like Subs or Client), then choose which groups
          can see each note you post. Notes with no group selected are visible
          to everyone. Guests in a group only share their own comments with that
          group.
        </p>
        {groups.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-zinc-700"
              >
                {group.name}
                <button
                  type="button"
                  aria-label={`Delete group ${group.name}`}
                  disabled={groupPending}
                  onClick={() =>
                    startGroupTransition(
                      async () => await deleteGroup(group.id, calendarId)
                    )
                  }
                  className="rounded-full px-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          action={createGroup.bind(null, calendarId)}
          className="mt-3 flex gap-2"
        >
          <input
            name="name"
            maxLength={40}
            placeholder="New group name"
            className={`${inputClass} min-w-0 flex-1 py-1.5`}
          />
          <button
            type="submit"
            className="flex-shrink-0 rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
          >
            Add group
          </button>
        </form>
      </div>

      {links.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              calendarId={calendarId}
              groups={groups}
            />
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="mt-4 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        {contacts.length > 0 && (
          <div className="relative">
            <select
              onChange={(e) => applyContact(e.target.value)}
              defaultValue=""
              className={selectClass}
            >
              <option value="" disabled>
                Reuse a saved contact…
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email || c.phone}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            name="contact_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className={inputClass}
          />
          <input
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            className={inputClass}
          />
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-40 flex-shrink-0">
            <select name="permission" defaultValue="view" className={selectClass}>
              <option value="view">View only</option>
              <option value="comment">Can comment</option>
            </select>
            <ChevronIcon />
          </div>
          <div className="relative w-48 flex-shrink-0">
            <select name="notify_via" defaultValue="" className={selectClass}>
              <option value="">No notifications</option>
              <option value="email">Notify by email</option>
            </select>
            <ChevronIcon />
          </div>
          {groups.length > 0 && (
            <div className="relative w-40 flex-shrink-0">
              <select name="group_id" defaultValue="" className={selectClass}>
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create link"}
          </button>
        </div>

        {state?.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
      </form>

      {state?.url && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
          <input
            readOnly
            value={state.url}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(state.url!);
              setShareCopied(true);
              setTimeout(() => setShareCopied(false), 1500);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
          >
            {shareCopied ? "Copied" : "Copy"}
          </button>
          {canShare && (
            <button
              onClick={() => navigator.share({ url: state.url })}
              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              Share
            </button>
          )}
        </div>
      )}
    </div>
  );
}
