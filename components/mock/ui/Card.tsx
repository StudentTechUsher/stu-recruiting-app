import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
}

export const Card = ({ header, footer, className = '', children, ...props }: CardProps) => {
  return (
    <article
      className={`rounded-3xl border border-[#d0ddd7] bg-white p-6 shadow-[0_20px_40px_-30px_rgba(10,31,26,0.5)] transition-shadow hover:shadow-[0_28px_52px_-36px_rgba(10,31,26,0.6)] dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100 dark:shadow-[0_24px_52px_-34px_rgba(2,6,23,0.75)] ${className}`}
      {...props}
    >
      {header ? <div className="mb-4 border-b border-[#dfe8e3] pb-4 dark:border-slate-700">{header}</div> : null}
      <div>{children}</div>
      {footer ? <div className="mt-4 border-t border-[#dfe8e3] pt-4 dark:border-slate-700">{footer}</div> : null}
    </article>
  );
};
