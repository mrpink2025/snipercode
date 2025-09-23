import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export const AnimatedCard = ({ children, className, delay = 0, hover = true }: AnimatedCardProps) => {
  return (
    <Card
      className={cn(
        'transition-all duration-300 ease-out',
        'animate-fade-in',
        hover && 'hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]',
        className
      )}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </Card>
  );
};