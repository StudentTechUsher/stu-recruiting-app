"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  defaultRecruiterViewReleaseFlags,
  defaultStudentOnboardingPreviewFlags,
  defaultStudentViewReleaseFlags,
  type RecruiterViewReleaseFlags,
  type StudentOnboardingPreviewFlags,
  type StudentViewReleaseFlags
} from "@/lib/feature-flags";

type FeatureFlagsContextValue = {
  recruiterViewReleaseFlags: RecruiterViewReleaseFlags;
  studentViewReleaseFlags: StudentViewReleaseFlags;
  studentOnboardingPreviewFlags: StudentOnboardingPreviewFlags;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  recruiterViewReleaseFlags: defaultRecruiterViewReleaseFlags,
  studentViewReleaseFlags: defaultStudentViewReleaseFlags,
  studentOnboardingPreviewFlags: defaultStudentOnboardingPreviewFlags
});

export function FeatureFlagsProvider({
  children,
  recruiterViewReleaseFlags,
  studentViewReleaseFlags,
  studentOnboardingPreviewFlags
}: {
  children: ReactNode;
  recruiterViewReleaseFlags: RecruiterViewReleaseFlags;
  studentViewReleaseFlags: StudentViewReleaseFlags;
  studentOnboardingPreviewFlags: StudentOnboardingPreviewFlags;
}) {
  return (
    <FeatureFlagsContext.Provider value={{ recruiterViewReleaseFlags, studentViewReleaseFlags, studentOnboardingPreviewFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
