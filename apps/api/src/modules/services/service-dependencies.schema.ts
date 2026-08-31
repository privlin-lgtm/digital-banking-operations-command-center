import { z } from 'zod';

const dependencyTypeValues = ['HARD', 'SOFT'] as const;

export const createServiceDependencySchema = z.object({
  dependsOnServiceId: z.string().min(1),
  dependencyType: z.enum(dependencyTypeValues).default('HARD'),
});

export type CreateServiceDependencyBody = z.infer<typeof createServiceDependencySchema>;
