import "server-only";
import { extensionDefinitions } from "./definitions";
import { classrooms } from "./classrooms";
import { courseManagement } from "./courses";
import { generation } from "./generation";
import { learning } from "./learning";
import { learningProfiles, learningPaths } from "./plans";
import { materials } from "./materials";
import { discussions } from "./discussions";
import { administration, accountProfiles } from "./administration";

export const platformExtensions = Object.freeze({
  classrooms,
  courseManagement,
  generation,
  learning,
  learningProfiles,
  learningPaths,
  materials,
  discussions,
  administration,
  accountProfiles,
});

export function getExtensionCapabilities() {
  return Object.entries(extensionDefinitions).flatMap(([domain, definitions]) =>
    Object.entries(definitions).map(([name, definition]) => ({
      operation: `${domain}.${name}`,
      status: definition.status,
      roles: [...definition.roles],
      resourcePolicy: definition.resourcePolicy,
    })),
  );
}
