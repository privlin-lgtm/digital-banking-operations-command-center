import { z } from 'zod';

const scenarioValues = [
  'DATABASE_OUTAGE',
  'NETWORK_LATENCY',
  'MEMORY_LEAK',
  'CPU_SPIKE',
  'SERVICE_DEGRADATION',
  'THIRD_PARTY_API_FAILURE',
] as const;

export const startSimulationSchema = z.object({
  serviceId: z.string().min(1),
  scenario: z.enum(scenarioValues),
});

export const listSimulationsQuerySchema = z.object({
  serviceId: z.string().min(1).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

export type StartSimulationBody = z.infer<typeof startSimulationSchema>;
export type ListSimulationsQuery = z.infer<typeof listSimulationsQuerySchema>;
