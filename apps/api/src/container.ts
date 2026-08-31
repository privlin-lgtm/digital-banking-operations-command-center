import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import { prisma as defaultPrisma } from './config/prisma.js';
import { logger as defaultLogger } from './config/logger.js';
import { PrismaAuditLogger } from './modules/audit/audit-logger.js';
import { PrismaAlertRulesRepository } from './modules/alerts/alert-rules.repository.js';
import { AlertsController } from './modules/alerts/alerts.controller.js';
import { PrismaAlertsRepository } from './modules/alerts/alerts.repository.js';
import { AlertsService } from './modules/alerts/alerts.service.js';
import { ThresholdEvaluator } from './modules/alerts/threshold-evaluator.js';
import { FailureSimulatorController } from './modules/failure-simulator/failure-simulator.controller.js';
import { PrismaFailureSimulationsRepository } from './modules/failure-simulator/failure-simulator.repository.js';
import { FailureSimulatorService } from './modules/failure-simulator/failure-simulator.service.js';
import { FailureScenarioGenerator } from './modules/failure-simulator/scenario-generator.js';
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
import { RemediationController } from './modules/remediation/remediation.controller.js';
import { RemediationEngine } from './modules/remediation/remediation-engine.js';
import {
  ClearCacheExecutor,
  FailoverSimulationExecutor,
  ReconnectDatabaseExecutor,
  RestartServiceExecutor,
  RetryOperationExecutor,
} from './modules/remediation/remediation-actions.js';
import type {
  RemediationActionType,
  RemediationExecutor,
} from './modules/remediation/remediation.types.js';
import { PrismaIncidentContextReader } from './modules/rca/incident-context-reader.js';
import { PrismaIncidentLookup as RcaPrismaIncidentLookup } from './modules/rca/incident-lookup.js';
import { RcaReportGenerator } from './modules/rca/rca-report-generator.js';
import { PrismaRcaReportsRepository } from './modules/rca/rca.repository.js';
import { RcaController } from './modules/rca/rca.controller.js';
import { RcaService } from './modules/rca/rca.service.js';
import { PrismaIncidentLookup } from './modules/runbooks/incident-lookup.js';
import { RunbooksController } from './modules/runbooks/runbooks.controller.js';
import { PrismaRunbooksRepository } from './modules/runbooks/runbooks.repository.js';
import { RunbooksService } from './modules/runbooks/runbooks.service.js';
import { SlaCalculator } from './modules/sla/sla-calculator.js';
import { PrismaSlaDataSource } from './modules/sla/sla-data.repository.js';
import { PrismaSlaRecordsRepository } from './modules/sla/sla-records.repository.js';
import { SlaController } from './modules/sla/sla.controller.js';
import { SlaTrackingService } from './modules/sla/sla.service.js';
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
  alerts: {
    repository: PrismaAlertsRepository;
    rulesRepository: PrismaAlertRulesRepository;
    evaluator: ThresholdEvaluator;
    service: AlertsService;
    controller: AlertsController;
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
  remediation: {
    engine: RemediationEngine;
    controller: RemediationController;
  };
  runbooks: {
    repository: PrismaRunbooksRepository;
    service: RunbooksService;
    controller: RunbooksController;
  };
  sla: {
    calculator: SlaCalculator;
    recordsRepository: PrismaSlaRecordsRepository;
    service: SlaTrackingService;
    controller: SlaController;
  };
  rca: {
    repository: PrismaRcaReportsRepository;
    service: RcaService;
    controller: RcaController;
  };
  failureSimulator: {
    repository: PrismaFailureSimulationsRepository;
    generator: FailureScenarioGenerator;
    service: FailureSimulatorService;
    controller: FailureSimulatorController;
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

  // Alerts are wired here — after IncidentsService exists (the engine
  // auto-creates incidents for SEV1/SEV2 firings) and before
  // ServiceHealthController (which triggers evaluation on every recorded
  // metric sample).
  const alertRulesRepository = new PrismaAlertRulesRepository(deps.prisma);
  const alertsRepository = new PrismaAlertsRepository(deps.prisma);
  const thresholdEvaluator = new ThresholdEvaluator();
  const alertsService = new AlertsService(
    alertsRepository,
    alertRulesRepository,
    incidentsService,
    thresholdEvaluator,
    auditLogger,
    deps.logger.child({ module: 'alerts' }),
  );
  const alertsController = new AlertsController(alertsService);

  const serviceHealthController = new ServiceHealthController(serviceHealthService, alertsService);

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

  const remediationExecutors: Partial<Record<RemediationActionType, RemediationExecutor>> = {
    RESTART_SERVICE: new RestartServiceExecutor(servicesRepository),
    RECONNECT_DATABASE: new ReconnectDatabaseExecutor(deps.prisma),
    CLEAR_CACHE: new ClearCacheExecutor(),
    RETRY_OPERATION: new RetryOperationExecutor(),
    FAILOVER_SIMULATION: new FailoverSimulationExecutor(),
  };
  const remediationEngine = new RemediationEngine(
    remediationExecutors,
    servicesRepository,
    incidentsService,
    auditLogger,
    deps.logger.child({ module: 'remediation' }),
  );
  const remediationController = new RemediationController(remediationEngine);

  const runbooksRepository = new PrismaRunbooksRepository(deps.prisma);
  const incidentLookup = new PrismaIncidentLookup(deps.prisma);
  const runbooksService = new RunbooksService(
    runbooksRepository,
    incidentLookup,
    auditLogger,
    deps.logger.child({ module: 'runbooks' }),
  );
  const runbooksController = new RunbooksController(runbooksService);

  const slaCalculator = new SlaCalculator();
  const slaDataSource = new PrismaSlaDataSource(deps.prisma);
  const slaRecordsRepository = new PrismaSlaRecordsRepository(deps.prisma);
  const slaTrackingService = new SlaTrackingService(
    slaDataSource,
    slaRecordsRepository,
    servicesRepository,
    slaCalculator,
    auditLogger,
    deps.logger.child({ module: 'sla' }),
  );
  const slaController = new SlaController(slaTrackingService);

  const rcaRepository = new PrismaRcaReportsRepository(deps.prisma);
  const rcaIncidentLookup = new RcaPrismaIncidentLookup(deps.prisma);
  const rcaContextReader = new PrismaIncidentContextReader(deps.prisma);
  const rcaReportGenerator = new RcaReportGenerator();
  const rcaService = new RcaService(
    rcaRepository,
    rcaIncidentLookup,
    rcaContextReader,
    rcaReportGenerator,
    auditLogger,
    deps.logger.child({ module: 'rca' }),
  );
  const rcaController = new RcaController(rcaService);

  // Reuses servicesRepository / serviceHealthService / alertsService as
  // narrow ports (ServiceLookup / MetricRecorder / MetricEvaluator) rather
  // than depending on their full classes — same reasoning as IncidentCreator
  // above. Wired last since it depends on all three already being built.
  const failureSimulationsRepository = new PrismaFailureSimulationsRepository(deps.prisma);
  const failureScenarioGenerator = new FailureScenarioGenerator();
  const failureSimulatorService = new FailureSimulatorService(
    failureSimulationsRepository,
    servicesRepository,
    serviceHealthService,
    alertsService,
    failureScenarioGenerator,
    auditLogger,
    deps.logger.child({ module: 'failure-simulator' }),
  );
  const failureSimulatorController = new FailureSimulatorController(failureSimulatorService);

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
    alerts: {
      repository: alertsRepository,
      rulesRepository: alertRulesRepository,
      evaluator: thresholdEvaluator,
      service: alertsService,
      controller: alertsController,
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
    remediation: {
      engine: remediationEngine,
      controller: remediationController,
    },
    runbooks: {
      repository: runbooksRepository,
      service: runbooksService,
      controller: runbooksController,
    },
    sla: {
      calculator: slaCalculator,
      recordsRepository: slaRecordsRepository,
      service: slaTrackingService,
      controller: slaController,
    },
    rca: {
      repository: rcaRepository,
      service: rcaService,
      controller: rcaController,
    },
    failureSimulator: {
      repository: failureSimulationsRepository,
      generator: failureScenarioGenerator,
      service: failureSimulatorService,
      controller: failureSimulatorController,
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
