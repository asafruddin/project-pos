import { actionToolsFor } from "./action-tools";
import { readToolsFor } from "./read-tools";
import type { AssistantDeps, AssistantTools, AssistantViewer } from "./types";

export type { AssistantDeps, AssistantTools, AssistantViewer } from "./types";

export function toolsFor(viewer: AssistantViewer, deps: AssistantDeps): AssistantTools {
  return { ...readToolsFor(viewer, deps), ...actionToolsFor(viewer, deps) };
}
