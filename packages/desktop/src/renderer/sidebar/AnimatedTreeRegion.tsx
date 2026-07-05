import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnimatedTreeRegionProps = {
  children: ReactNode;
  className: string;
  expanded: boolean;
};

export function AnimatedTreeRegion({ children, className, expanded }: AnimatedTreeRegionProps) {
  return (
    <div
      aria-hidden={!expanded}
      className={cn(
        "grid min-w-0 transition-[grid-template-rows,opacity,transform] duration-[var(--motion-duration-panel)] ease-[var(--motion-ease-emphasized)]",
        expanded ? "grid-rows-[1fr] translate-y-0 opacity-100" : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"
      )}
      inert={expanded ? undefined : true}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}
