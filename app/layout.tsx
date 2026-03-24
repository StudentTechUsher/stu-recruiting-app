import type { Metadata } from "next";
import { FeatureFlagsProvider } from "@/components/FeatureFlagsProvider";
import { defaultRecruiterViewReleaseFlags, defaultStudentOnboardingPreviewFlags, defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stu Recruiting",
  description: "Official Stu Recruiting platform for students and recruiters"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FeatureFlagsProvider
          recruiterViewReleaseFlags={defaultRecruiterViewReleaseFlags}
          studentViewReleaseFlags={defaultStudentViewReleaseFlags}
          studentOnboardingPreviewFlags={defaultStudentOnboardingPreviewFlags}
        >
          {children}
        </FeatureFlagsProvider>
      </body>
    </html>
  );
}
