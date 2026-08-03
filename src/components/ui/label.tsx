import * as React from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-foreground text-sm leading-none font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
