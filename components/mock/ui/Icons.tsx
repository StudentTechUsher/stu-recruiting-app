import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseClassName = 'h-5 w-5';

export const ModelIcon = ({ className = baseClassName, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} {...props}>
    <rect x="3" y="4" width="7" height="7" rx="2" />
    <rect x="14" y="4" width="7" height="7" rx="2" />
    <rect x="8.5" y="13" width="7" height="7" rx="2" />
    <path d="M10 7.5h4M12 11v2" />
  </svg>
);

export const LayersIcon = ({ className = baseClassName, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} {...props}>
    <path d="M12 3L3 8l9 5 9-5-9-5z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 18l9 5 9-5" />
  </svg>
);

export const ChartIcon = ({ className = baseClassName, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} {...props}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 15l3-3 3 2 4-5" />
  </svg>
);

export const LoopIcon = ({ className = baseClassName, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} {...props}>
    <path d="M4 12a8 8 0 0113.66-5.66L20 8" />
    <path d="M20 12a8 8 0 01-13.66 5.66L4 16" />
    <path d="M20 8h-5" />
    <path d="M4 16h5" />
  </svg>
);
