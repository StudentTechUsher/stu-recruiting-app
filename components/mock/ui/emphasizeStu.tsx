import type { ReactNode } from 'react';

const STU_TOKEN = 'stu.';

export const emphasizeStu = (text: string): ReactNode => {
  const segments = text.split(STU_TOKEN);

  if (segments.length === 1) {
    return text;
  }

  return segments.flatMap((segment, index) => {
    if (index === segments.length - 1) {
      return segment;
    }

    return [
      segment,
      <strong key={`stu-token-${index}`} className="font-bold">
        {STU_TOKEN}
      </strong>
    ];
  });
};
