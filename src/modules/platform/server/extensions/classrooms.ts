import "server-only";
import { getClassroomRepository } from "@/shared/database/classrooms";
import { createClassroomService } from "../classroom-service";
export const classrooms = createClassroomService(getClassroomRepository);
