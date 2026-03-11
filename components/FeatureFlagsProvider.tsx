"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  defaultStudentOnboardingPreviewFlags,
  defaultStudentViewReleaseFlags,
  type StudentOnboardingPreviewFlags,
  type StudentViewReleaseFlags
} from "@/lib/feature-flags";

type FeatureFlagsContextValue = {
  studentViewReleaseFlags: StudentViewReleaseFlags;
  studentOnboardingPreviewFlags: StudentOnboardingPreviewFlags;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  studentViewReleaseFlags: defaultStudentViewReleaseFlags,
  studentOnboardingPreviewFlags: defaultStudentOnboardingPreviewFlags
});

export function FeatureFlagsProvider({
  children,
  studentViewReleaseFlags,
  studentOnboardingPreviewFlags
}: {
  children: ReactNode;
  studentViewReleaseFlags: StudentViewReleaseFlags;
  studentOnboardingPreviewFlags: StudentOnboardingPreviewFlags;
}) {
  return (
    <FeatureFlagsContext.Provider value={{ studentViewReleaseFlags, studentOnboardingPreviewFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
