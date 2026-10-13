export type TourStep = {
  // Which page the step lives on, so the tour can move between them.
  page?: "dashboard" | "calendar";
  // Matches data-tour="..." on the element to point at. Omit for a centered card.
  target?: string;
  title: string;
  body: string;
};

export const OWNER_STEPS: TourStep[] = [
  {
    page: "dashboard",
    title: "Welcome to Tapd In",
    body: "A one-minute tour. You can replay it any time from the menu: How to use.",
  },
  {
    page: "dashboard",
    target: "create-calendar",
    title: "Start a calendar",
    body: "One per project or team. Name it and you're in.",
  },
  {
    page: "dashboard",
    target: "settings",
    title: "Your settings",
    body: "Choose the name your team sees, and whether to get emailed about activity.",
  },
  {
    page: "calendar",
    target: "calendar-header",
    title: "Name and time zone",
    body: "Set the time zone once so everyone sees the right times.",
  },
  {
    page: "calendar",
    target: "views",
    title: "Four ways to look",
    body: "Month, week, day, or a simple list.",
  },
  {
    page: "calendar",
    target: "grid",
    title: "Tap any day or item",
    body: "Open it to change the date and time, post notes and photos, and see its history.",
  },
  {
    page: "calendar",
    target: "invite",
    title: "Invite your team",
    body: "Share a link, no account needed. Put people in groups to control who sees what.",
  },
  {
    page: "calendar",
    target: "assistant",
    title: "Ask AI",
    body: "Ask about the schedule or tell it what to change. You approve every change.",
  },
  {
    page: "calendar",
    title: "You're all set",
    body: "Replay this any time from the menu: How to use.",
  },
];

export const GUEST_STEPS: TourStep[] = [
  {
    title: "Welcome",
    body: "Here's what you can do on this page. It takes under a minute.",
  },
  {
    target: "notify",
    title: "Get updates",
    body: "Choose a text or an email when something changes.",
  },
  {
    target: "add-to-calendar",
    title: "Add it to your calendar",
    body: "Google, Apple or Outlook stay up to date automatically.",
  },
  {
    target: "comment",
    title: "Join the conversation",
    body: "Post notes and photos on any item. Only the people it's shared with see them.",
  },
  {
    target: "assistant",
    title: "Ask AI",
    body: "Ask what's coming up or what changed.",
  },
  {
    title: "That's it",
    body: "Replay this any time from the menu: How to use.",
  },
];
