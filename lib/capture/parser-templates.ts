import { parseWithProviderPacks } from "@/lib/capture/providers";

export function parseWithTemplates(text: string) {
  return parseWithProviderPacks(text);
}
