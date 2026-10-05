import { useWindowDimensions } from "react-native";
import { breakpoints } from "@/theme";

export type Layout = "phone" | "tablet" | "wide";

/** PWA breakpoints: < md phone (bottom nav + cart panel), md–lg tablet (side cart), ≥ lg wide (sidebar + side cart). */
export function layoutFor(width: number): Layout {
  if (width >= breakpoints.lg) return "wide";
  if (width >= breakpoints.md) return "tablet";
  return "phone";
}

export function useLayout(): { layout: Layout; width: number; height: number; landscape: boolean } {
  const { width, height } = useWindowDimensions();
  return { layout: layoutFor(width), width, height, landscape: width > height };
}
