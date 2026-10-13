import type { PhaseStatus } from "@/lib/actions/calendar-items";
import { formatTime } from "@/lib/format-time";
import { selectPhasesToShift, type ShiftablePhase } from "@/lib/shift-phases";

export type Proposal =
  | {
      type: "create_item";
      label: string;
      date: string | null;
      time: string | null;
      notes: string | null;
      status: PhaseStatus;
      // null = visible to everyone.
      group_ids: string[] | null;
    }
  | {
      type: "update_item";
      id: string;
      label?: string;
      date?: string | null;
      time?: string | null;
      notes?: string;
      status?: PhaseStatus;
      // Absent = unchanged; null = make visible to everyone; array = limit.
      group_ids?: string[] | null;
    }
  | { type: "shift_items"; from_item_id: string; days: number }
  | {
      type: "add_note";
      item_id: string;
      text: string;
      // null = visible to everyone on the calendar.
      group_ids: string[] | null;
    }
  | { type: "assign_guest_group"; guest_id: string; group_id: string | null };

export type AssistantGroup = { id: string; name: string };
export type AssistantGuest = {
  id: string;
  contact_name: string | null;
  group_id: string | null;
};

export type AssistantItem = ShiftablePhase & {
  label: string;
  notes: string | null;
  status: PhaseStatus;
  visible_group_ids: string[] | null;
};

export const MAX_PROPOSALS = 25;

const STATUSES: PhaseStatus[] = ["scheduled", "in_progress", "done", "delayed"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const isTime = (value: unknown): value is string =>
  typeof value === "string" && TIME.test(value);
const isStatus = (value: unknown): value is PhaseStatus =>
  typeof value === "string" && (STATUSES as string[]).includes(value);
const isId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

type Parsed = { proposal: Proposal } | { error: string };

const AUDIENCE_ERROR =
  "Say who can see this: audience 'everyone', or audience 'groups' with the group_ids.";

// null/undefined = everyone; otherwise a non-empty list of group ids.
function parseGroupIds(value: unknown): { ids: string[] | null } | { error: string } {
  if (value === null || value === undefined) return { ids: null };
  if (!Array.isArray(value) || value.length === 0 || value.length > 20 || !value.every(isId)) {
    return { error: AUDIENCE_ERROR };
  }
  return { ids: [...new Set(value as string[])] };
}
const fail = (error: string): Parsed => ({ error });

// Validates the canonical shape. Used both on what the model proposes and,
// again, on what the browser sends back when the owner clicks Apply.
export function parseProposal(raw: unknown): Parsed {
  if (typeof raw !== "object" || raw === null) return fail("Invalid proposal.");
  const input = raw as Record<string, unknown>;

  if (input.type === "create_item") {
    const label = typeof input.label === "string" ? input.label.trim() : "";
    if (!label || label.length > 120) return fail("label must be 1-120 characters.");
    const date = input.date ?? null;
    const time = input.time ?? null;
    const notes = input.notes ?? null;
    const status = input.status ?? "scheduled";
    if (date !== null && !isValidDateKey(date)) return fail("date must be YYYY-MM-DD.");
    if (time !== null && !isTime(time)) return fail("time must be 24-hour HH:MM.");
    if (time !== null && date === null) return fail("A time needs a date.");
    if (notes !== null && (typeof notes !== "string" || notes.length > 1000)) {
      return fail("notes must be text up to 1000 characters.");
    }
    if (!isStatus(status)) return fail("Invalid status.");
    const audience = parseGroupIds(input.group_ids);
    if ("error" in audience) return fail(audience.error);
    return {
      proposal: { type: "create_item", label, date, time, notes, status, group_ids: audience.ids },
    };
  }

  if (input.type === "update_item") {
    if (!isId(input.id)) return fail("Invalid item id.");
    const proposal: Proposal = { type: "update_item", id: input.id };
    if ("label" in input) {
      const label = typeof input.label === "string" ? input.label.trim() : "";
      if (!label || label.length > 120) return fail("label must be 1-120 characters.");
      proposal.label = label;
    }
    if ("date" in input) {
      if (input.date !== null && !isValidDateKey(input.date)) return fail("date must be YYYY-MM-DD or null.");
      proposal.date = input.date as string | null;
    }
    if ("time" in input) {
      if (input.time !== null && !isTime(input.time)) return fail("time must be 24-hour HH:MM or null.");
      proposal.time = input.time as string | null;
    }
    if ("notes" in input) {
      if (typeof input.notes !== "string" || input.notes.length > 1000) {
        return fail("notes must be text up to 1000 characters.");
      }
      proposal.notes = input.notes;
    }
    if ("status" in input) {
      if (!isStatus(input.status)) return fail("Invalid status.");
      proposal.status = input.status;
    }
    if ("group_ids" in input) {
      const audience = parseGroupIds(input.group_ids);
      if ("error" in audience) return fail(audience.error);
      proposal.group_ids = audience.ids;
    }
    if (Object.keys(proposal).length === 2) return fail("Nothing to change.");
    if (proposal.date === null && proposal.time === undefined) proposal.time = null;
    return { proposal };
  }

  if (input.type === "shift_items") {
    if (!isId(input.from_item_id)) return fail("Invalid item id.");
    const days = input.days;
    if (typeof days !== "number" || !Number.isInteger(days) || days === 0 || Math.abs(days) > 365) {
      return fail("days must be a non-zero whole number up to 365.");
    }
    return { proposal: { type: "shift_items", from_item_id: input.from_item_id, days } };
  }

  if (input.type === "add_note") {
    if (!isId(input.item_id)) return fail("Invalid item id.");
    const text = typeof input.text === "string" ? input.text.trim() : "";
    if (!text || text.length > 1000) return fail("text must be 1-1000 characters.");
    const ids = input.group_ids;
    if (ids === null) {
      return { proposal: { type: "add_note", item_id: input.item_id, text, group_ids: null } };
    }
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20 || !ids.every(isId)) {
      return fail(
        "Say who can see this note: audience 'everyone', or audience 'groups' with the group_ids."
      );
    }
    return {
      proposal: {
        type: "add_note",
        item_id: input.item_id,
        text,
        group_ids: [...new Set(ids as string[])],
      },
    };
  }

  if (input.type === "assign_guest_group") {
    if (!isId(input.guest_id)) return fail("Invalid guest id.");
    if (input.group_id !== null && !isId(input.group_id)) return fail("Invalid group id.");
    return {
      proposal: { type: "assign_guest_group", guest_id: input.guest_id, group_id: input.group_id },
    };
  }

  return fail("Unknown proposal type.");
}

// 'everyone' -> null, 'groups' -> the ids (or a value that fails validation if
// they're missing), omitted -> no change to visibility. Anything else is
// rejected rather than guessed.
function withAudience(args: Record<string, unknown>): Record<string, unknown> {
  const { audience, group_ids, ...rest } = args;
  if (audience === undefined) return rest;
  if (audience === "everyone") return { ...rest, group_ids: null };
  if (audience === "groups") return { ...rest, group_ids: group_ids ?? "missing" };
  return { ...rest, group_ids: "invalid" };
}

// Maps the model's tool call onto the canonical proposal shape.
export function proposalFromToolCall(name: string, input: unknown): unknown {
  const args = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (name === "propose_create_item") {
    return { type: "create_item", ...withAudience(args) };
  }
  if (name === "propose_update_item") {
    const { item_id, ...rest } = args;
    return { type: "update_item", id: item_id, ...withAudience(rest) };
  }
  if (name === "propose_shift_items") return { type: "shift_items", ...args };
  if (name === "propose_add_note") {
    // The audience must be chosen on purpose: an omitted or unclear audience
    // is rejected instead of silently meaning "everyone".
    const { audience, group_ids, ...rest } = args;
    const groupIds =
      audience === "everyone" ? null : audience === "groups" ? group_ids : undefined;
    return { type: "add_note", ...rest, group_ids: groupIds };
  }
  if (name === "propose_assign_guest_group") {
    const { group_id, ...rest } = args;
    return { type: "assign_guest_group", ...rest, group_id: group_id ?? null };
  }
  return null;
}

const dayText = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const STATUS_TEXT: Record<PhaseStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Done",
  delayed: "Delayed",
};

// What the owner sees before approving. Built from our own data, not from
// anything the model wrote.
export function describeProposal(
  proposal: Proposal,
  items: AssistantItem[],
  directory: { groups: AssistantGroup[]; guests: AssistantGuest[] } = { groups: [], guests: [] }
): string {
  const byId = new Map(items.map((item) => [item.id, item]));
  const groupName = (id: string | null) =>
    directory.groups.find((group) => group.id === id)?.name ?? "an unknown group";

  if (proposal.type === "add_note") {
    const item = byId.get(proposal.item_id);
    const preview =
      proposal.text.length > 80 ? `${proposal.text.slice(0, 80)}…` : proposal.text;
    const audience = proposal.group_ids
      ? `visible only to ${proposal.group_ids.map(groupName).join(", ")}`
      : "visible to EVERYONE on the calendar";
    return `Post a note on "${item?.label ?? "item"}": "${preview}" (${audience})`;
  }

  if (proposal.type === "assign_guest_group") {
    const guest = directory.guests.find((g) => g.id === proposal.guest_id);
    const who = guest?.contact_name || "an unnamed guest";
    return proposal.group_id
      ? `Put ${who} in the ${groupName(proposal.group_id)} group`
      : `Remove ${who} from their group`;
  }

  if (proposal.type === "create_item") {
    const when = proposal.date
      ? `${dayText(proposal.date)}${proposal.time ? ` at ${formatTime(proposal.time)}` : ""}`
      : "no date yet";
    const audience = proposal.group_ids
      ? `, visible only to ${proposal.group_ids.map(groupName).join(", ")}`
      : "";
    return `Add "${proposal.label}" (${when}${audience})`;
  }

  if (proposal.type === "update_item") {
    const item = byId.get(proposal.id);
    const changes: string[] = [];
    if (proposal.label !== undefined) changes.push(`rename to "${proposal.label}"`);
    if (proposal.date !== undefined) {
      changes.push(proposal.date ? `date to ${dayText(proposal.date)}` : "remove the date");
    }
    if (proposal.time !== undefined && proposal.date !== null) {
      changes.push(proposal.time ? `time to ${formatTime(proposal.time)}` : "remove the time");
    }
    if (proposal.notes !== undefined) changes.push("update the notes");
    if (proposal.status !== undefined) changes.push(`mark ${STATUS_TEXT[proposal.status]}`);
    if (proposal.group_ids !== undefined) {
      changes.push(
        proposal.group_ids
          ? `limit it to ${proposal.group_ids.map(groupName).join(", ")}`
          : "make it visible to everyone"
      );
    }
    return `Update "${item?.label ?? "item"}": ${changes.join(", ")}`;
  }

  const anchor = byId.get(proposal.from_item_id);
  const count = anchor ? selectPhasesToShift(anchor, items).length : 0;
  const direction = proposal.days > 0 ? "later" : "earlier";
  const size = Math.abs(proposal.days);
  return `Move "${anchor?.label ?? "item"}" and everything after it ${size} ${
    size === 1 ? "day" : "days"
  } ${direction} (${count} ${count === 1 ? "item" : "items"})`;
}
