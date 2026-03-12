"use client";

import { StudentManageRoles } from "@/components/mock/StudentManageRoles/StudentManageRoles";

export default function StudentTargetsPage() {
  return (
    <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
      <StudentManageRoles view="targets" />
    </main>
  );
}
