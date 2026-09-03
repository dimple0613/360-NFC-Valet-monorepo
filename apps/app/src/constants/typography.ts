const FONTS = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semiBold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  extraBold: "PlusJakartaSans-ExtraBold",
} as const;

const WEIGHT_TO_FONT: Record<string, string> = {
  "400": FONTS.regular,
  "500": FONTS.medium,
  "600": FONTS.semiBold,
  "700": FONTS.bold,
  "800": FONTS.extraBold,
};

export const Typography = {
  fontFamily: FONTS,
  font(weight?: string | number): string {
    const w = String(weight ?? "400");
    return WEIGHT_TO_FONT[w] ?? FONTS.regular;
  },
  size: {
    overline: 11,
    xs: 12,
    sm: 13,
    md: 14,
    base: 15,
    lg: 16,
    xl: 19,
    xxl: 20,
    display: 22,
    hero: 28,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  } as const,
} as const;
