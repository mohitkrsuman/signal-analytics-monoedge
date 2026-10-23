"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Live" },
  { href: "/history", label: "History" },
  { href: "/incidents", label: "Incidents" },
];

function linkClass(active: boolean) {
  return `shrink-0 rounded-md px-3 py-2.5 text-sm whitespace-nowrap md:py-2 ${
    active
      ? "bg-neutral-900 font-medium text-white"
      : "text-neutral-700 hover:bg-neutral-100"
  }`;
}

export function MonitorNavFallback() {
  return (
    <nav aria-label="Monitor" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      <p className="hidden px-3 pb-1 text-xs font-medium tracking-wide text-neutral-400 uppercase md:block">
        Monitor
      </p>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={linkClass(false)}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function MonitorNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Monitor" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      <p className="hidden px-3 pb-1 text-xs font-medium tracking-wide text-neutral-400 uppercase md:block">
        Monitor
      </p>
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={linkClass(active)}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
