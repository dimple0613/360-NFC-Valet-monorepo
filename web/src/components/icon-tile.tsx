import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// The design reference sits every section / page / stat icon inside a
// rounded, tinted square — line icon, single stroke weight. This is that
// square. Pass a lucide icon as the child; the tile sizes it.

const iconTileVariants = cva(
  "inline-flex shrink-0 items-center justify-center [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Sunset tint behind a Sunset icon — the default, for page/section headers. */
        tint: "bg-accent text-primary",
        /** Neutral — for empty states and low-emphasis contexts. */
        muted: "bg-muted text-muted-foreground",
        /** Solid Sunset behind a white icon — for a brand mark. */
        solid: "bg-primary text-primary-foreground shadow-(--shadow-glow)",
      },
      size: {
        sm: "size-8 rounded-lg [&>svg]:size-4",
        md: "size-10 rounded-lg [&>svg]:size-5",
        lg: "size-12 rounded-xl [&>svg]:size-6",
      },
    },
    defaultVariants: { variant: "tint", size: "md" },
  },
);

export function IconTile({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof iconTileVariants>) {
  return (
    <span aria-hidden className={cn(iconTileVariants({ variant, size }), className)} {...props}>
      {children}
    </span>
  );
}
