"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Briefing" },
  { href: "/dashboard/people", label: "People" },
  { href: "/dashboard/settings", label: "Settings" },
];

// The page you're on is darker and underlined, so you always know where you are.
export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label }) => {
        const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "font-medium text-ink underline decoration-accent decoration-2 underline-offset-[10px]"
                : "text-muted transition-colors hover:text-ink"
            }
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
