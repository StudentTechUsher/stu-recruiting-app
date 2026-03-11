"use client";

import { AppNavigationShell } from "@/components/AppNavigationShell";
import { StudentManageRoles } from "@/components/mock/StudentManageRoles/StudentManageRoles";

export default function StudentProfilePage() {
  return (
    <AppNavigationShell audience="student">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <StudentManageRoles />
      </main>
    </AppNavigationShell>
  );
}
