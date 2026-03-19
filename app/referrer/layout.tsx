"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavigationShell } from "@/components/AppNavigationShell";

export default function ReferrerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showNavigation = !pathname.startsWith("/referrer/onboarding");

  return (
    <AppNavigationShell audience="referrer" showNavigation={showNavigation}>
      {children}
    </AppNavigationShell>
  );
}
