"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppNavigationShell } from "@/components/AppNavigationShell";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showNavigation = !pathname.startsWith("/student/onboarding");

  return (
    <AppNavigationShell audience="student" showNavigation={showNavigation}>
      {children}
    </AppNavigationShell>
  );
}
