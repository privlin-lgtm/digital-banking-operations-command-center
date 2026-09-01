import { z } from 'zod';
import { DEMO_SCENARIOS } from './demo-scenarios.js';

export const enableDemoModeSchema = z.object({
  scenario: z.enum(DEMO_SCENARIOS).optional(),
  intensity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  autoLoop: z.boolean().optional(),
});

export type EnableDemoModeBody = z.infer<typeof enableDemoModeSchema>;
