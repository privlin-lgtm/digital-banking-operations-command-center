import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { prisma as defaultPrisma } from './config/prisma.js';
import { logger as defaultLogger } from './config/logger.js';
import { PrismaAuditLogger } from './modules/audit/audit-logger.js';
import { EscalationEngine } from './modules/incidents/escalation-engine.js';
import { PrismaIncidentCommentsRepository } from './modules/incidents/incident-comments.repository.js';
import { IncidentEscalationController } from './modules/incidents/incident-escalation.controller.js';
import { IncidentEscalationService } from './modules/incidents/incident-escalation.service.js';
import { LoggingIncidentNotifier } from './modules/incidents/incident-notifier.js';
import { PrismaIncidentRcaGate } from './modules/incidents/incident-rca-gate.js';
import { PrismaIncidentTimelineRepository } from './modules/incidents/incident-timeline.repository.js';
import { IncidentsController } from './modules/incidents/incidents.controller.js';
import { PrismaIncidentsRepository } from './modules/incidents/incidents.repository.js';
import { IncidentsService } from './modules/incidents/incidents.service.js';
import { PrismaUserLookup } from './modules/incidents/user-lookup.js';
import { PrismaServiceDependenciesRepository } from './modules/services/service-dependencies.repository.js';
import { ServiceDependencyService } from './modules/services/service-dependencies.service.js';
import { ServiceDependenciesController } from './modules/services/service-dependencies.controller.js';
import { PrismaServiceMetricsRepository } from './modules/services/service-metrics.repository.js';
import { ServiceHealthService } from './modules/services/service-metrics.service.js';
import { ServiceHealthController } from './modules/services/service-metrics.controller.js';
import { PrismaServicesRepository } from './modules/services/services.repository.js';
import { ServicesService } from './modules/services/services.service.js';
import { ServicesController } from './modules/services/services.controller.js';

/**
 * Dependency injection, without a DI framework.
 *
 * This is a "poor man's DI" composition root: one place that constructs
 * every repository/service/controller and wires them together via plain
 * constructor injection. No decorators, no reflect-metadata, no runtime
 * container magic — for an app this size, a framework like InversifyJS
 * would add indirection without adding capability. What actually matters
 * for testability and swappability is that:
 *
 *   1. Each class declares its dependencies as constructor parameters
 *      typed against an interface (see `ServicesRepository`), not by
 *      importing a concrete implementation or a global singleton.
 *   2. Exactly one place (`buildContainer`) decides which concrete
 *      implementation satisfies each interface.
 *
 * A test can call `buildContainer({ prisma: fakePrisma, logger: silentLogger })`
 * — or construct a `ServicesService` directly with a hand-written fake
 * repository — without touching this file or a real database.
 */
export interface AppContainer {
  prisma: PrismaClient;
  logger: Logger;
  services: {
    repository: PrismaServicesRepository;
    service: ServicesService;
    controller: ServicesController;
  };
  serviceDependencies: {
    repository: PrismaServiceDependenciesRepository;
    service: ServiceDependencyService;
    controller: ServiceDependenciesController;
  };
  serviceHealth: {
    repository: PrismaServiceMetricsRepository;
    service: ServiceHealthService;
    controller: ServiceHealthController;
  };
  incidents: {
    repository: PrismaIncidentsRepository;
    service: IncidentsService;
    controller: IncidentsController;
  };
  incidentEscalation: {
    engine: EscalationEngine;
    service: IncidentEscalationService;
    controller: IncidentEscalationController;
  };
}

export interface ContainerDeps {
  prisma: PrismaClient;
  logger: Logger;
}

export function buildContainer(deps: ContainerDeps): AppContainer {
  const auditLogger = new PrismaAuditLogger(deps.prisma);

  const servicesRepository = new PrismaServicesRepository(deps.prisma);
  const servicesService = new ServicesService(
    servicesRepository,
    auditLogger,
    deps.logger.child({ module: 'services' }),
  );
  const servicesController = new ServicesController(servicesService);

  const serviceDependenciesRepository = new PrismaServiceDependenciesRepository(deps.prisma);
  const serviceDependencyService = new ServiceDependencyService(
    serviceDependenciesRepository,
    servicesRepository,
    auditLogger,
  );
  const serviceDependenciesController = new ServiceDependenciesController(serviceDependencyService);

  const serviceMetricsRepository = new PrismaServiceMetricsRepository(deps.prisma);
  const serviceHealthService = new ServiceHealthService(
    serviceMetricsRepository,
    servicesRepository,
    deps.logger.child({ module: 'service-health' }),
  );
  const serviceHealthController = new ServiceHealthController(serviceHealthService);

  const incidentsRepository = new PrismaIncidentsRepository(deps.prisma);
  const incidentTimelineRepository = new PrismaIncidentTimelineRepository(deps.prisma);
  const incidentCommentsRepository = new PrismaIncidentCommentsRepository(deps.prisma);
  const incidentRcaGate = new PrismaIncidentRcaGate(deps.prisma);
  const userLookup = new PrismaUserLookup(deps.prisma);
  const incidentsService = new IncidentsService(
    incidentsRepository,
    incidentTimelineRepository,
    incidentCommentsRepository,
    servicesRepository,
    incidentRcaGate,
    userLookup,
    auditLogger,
    deps.logger.child({ module: 'incidents' }),
  );
  const incidentsController = new IncidentsController(incidentsService);

  const escalationEngine = new EscalationEngine();
  const incidentNotifier = new LoggingIncidentNotifier(
    deps.logger.child({ module: 'incident-notifier' }),
  );
  const incidentEscalationService = new IncidentEscalationService(
    incidentsRepository,
    incidentTimelineRepository,
    incidentNotifier,
    auditLogger,
    escalationEngine,
    deps.logger.child({ module: 'incident-escalation' }),
  );
  const incidentEscalationController = new IncidentEscalationController(incidentEscalationService);

  return {
    prisma: deps.prisma,
    logger: deps.logger,
    services: {
      repository: servicesRepository,
      service: servicesService,
      controller: servicesController,
    },
    serviceDependencies: {
      repository: serviceDependenciesRepository,
      service: serviceDependencyService,
      controller: serviceDependenciesController,
    },
    serviceHealth: {
      repository: serviceMetricsRepository,
      service: serviceHealthService,
      controller: serviceHealthController,
    },
    incidents: {
      repository: incidentsRepository,
      service: incidentsService,
      controller: incidentsController,
    },
    incidentEscalation: {
      engine: escalationEngine,
      service: incidentEscalationService,
      controller: incidentEscalationController,
    },
  };
}

let singleton: AppContainer | undefined;

/** The app's real, process-wide container — built once, lazily, from the real Prisma client and logger. */
export function getContainer(): AppContainer {
  if (!singleton) {
    singleton = buildContainer({ prisma: defaultPrisma, logger: defaultLogger });
  }
  return singleton;
}

/** Test-only escape hatch: forces the next getContainer() to rebuild. */
export function resetContainer(): void {
  singleton = undefined;
}
