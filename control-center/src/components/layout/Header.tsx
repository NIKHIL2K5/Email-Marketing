'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  UserCheck,
  Shield,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Operations Dashboard',
    subtitle: 'Real-time campaign telemetry and email sending controls',
  },
  '/campaigns': {
    title: 'Campaigns',
    subtitle: 'Manage cold outreach sequences and sending rate envelopes',
  },
  '/campaigns/new': {
    title: 'Create Campaign',
    subtitle: 'Configure target limits, schedules, and delivery throttling',
  },
  '/audiences': {
    title: 'Audience Definitions',
    subtitle: 'Authoritative database segment definitions, snapshots, and eligibility filters',
  },
  '/templates': {
    title: 'Template Studio',
    subtitle: 'Manage email templates, variables, and versioned copies',
  },
  '/n8n': {
    title: 'n8n Production Execution Console',
    subtitle: 'Mission control for execution pipeline, slot claiming, and controlled cycles',
  },
  '/contacts': {
    title: 'Contact Repository',
    subtitle: 'Authoritative recipient records, eligibility, and suppressions',
  },
  '/deliverability': {
    title: 'Deliverability & Health',
    subtitle: 'Delivery rates, hard/soft bounces, and provider feedback loops',
  },
  '/system-health': {
    title: 'System Health',
    subtitle: 'Connectivity and latency across PostgreSQL, n8n, Listmonk & Brevo',
  },
  '/settings': {
    title: 'Global Settings',
    subtitle: 'Platform rate envelopes, provider credentials status, and safety limits',
  },
  '/audit': {
    title: 'Operational Audit Log',
    subtitle: 'Immutable record of campaign starts, execution cycles, slot claims, and errors',
  },
};

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const pathname = usePathname();
  const currentInfo = pageTitles[pathname] || {
    title: 'First Client Control Center',
    subtitle: 'PostgreSQL · n8n · Listmonk · Brevo pipeline',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-6">
      {/* Left: Mobile hamburger & Dynamic Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-lg">
            {currentInfo.title}
          </h1>
          <p className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Quick Search, Notifications, Operator Profile */}
      <div className="flex items-center gap-3">
        {/* Search bar */}
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search campaigns, contacts, events..."
            className="h-9 w-64 rounded-lg border border-zinc-200 bg-zinc-50/70 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 transition focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-700 dark:focus:bg-zinc-900 lg:w-80"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850"
            title="System notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          </button>
        </div>

        {/* Operator Profile Menu with Sign Out */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/60 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-800">
              <UserCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-xs font-semibold leading-none text-zinc-800 dark:text-zinc-200">
                Operator
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-emerald-500" /> Authenticated
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/auth?action=logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
            title="Sign out of Control Center"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
