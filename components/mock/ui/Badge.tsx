import type { HTMLAttributes } from 'react';

export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export const Badge = ({ className = '', children, ...props }: BadgeProps) => (
  <span
    className={`inline-flex items-center rounded-full bg-[#eef6f1] px-3 py-1 text-xs font-semibold text-[#325148] dark:bg-emerald-500/20 dark:text-emerald-100 ${className}`}
    {...props}
  >
    {children}
  </span>
);
