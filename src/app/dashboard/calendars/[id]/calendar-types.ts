import type { PhaseStatus } from "@/lib/actions/calendar-items";

export type Phase = {
  id: string;
  label: string;
  target_date: string | null;
  start_time: string | null;
  notes: string | null;
  status: PhaseStatus;
  sort_order: number;
  visible_group_ids: string[] | null;
  updated_at: string;
};

export type Entry = {
  id: string;
  calendar_item_id: string;
  author_label: string | null;
  body_text: string | null;
  photo_url: string | null;
  media_type: string | null;
  visible_group_ids: string[] | null;
  created_at: string;
};
