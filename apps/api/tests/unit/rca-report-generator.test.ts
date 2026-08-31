import { describe, expect, it } from 'vitest';
import { RcaReportGenerator } from '../../src/modules/rca/rca-report-generator.js';

describe('RcaReportGenerator', () => {
  const generator = new RcaReportGenerator();

  const baseInput = {
    incident: {
      id: 'inc-1',
      title: 'Elevated 5xx rate on outbound wire submission',
      severity: 'SEV1',
      status: 'CLOSED',
      primaryServiceName: 'Payments Gateway',
      commanderName: 'Dana Cohen',
      openedAt: new Date('2026-01-01T00:00:00Z'),
      acknowledgedAt: new Date('2026-01-01T00:05:00Z'),
      resolvedAt: new Date('2026-01-01T01:05:00Z'),
      closedAt: new Date('2026-01-02T00:00:00Z'),
    },
    timeline: [
      {
        at: new Date('2026-01-01T00:00:00Z'),
        actorName: null,
        summary: '[CREATED] Incident opened at SEV1',
      },
      {
        at: new Date('2026-01-01T00:05:00Z'),
        actorName: 'Dana Cohen',
        summary: '[ACKNOWLEDGED] Incident acknowledged',
      },
    ],
    report: {
      status: 'APPROVED',
      rootCause: 'Connection pool exhaustion after a deploy shrank max pool size.',
      rootCauseCategory: 'CONFIGURATION_CHANGE',
      contributingFactors: 'No saturation alert existed on the pool.',
      authoredByName: 'Yossi Levi',
      reviewedByName: 'Dana Cohen',
      publishedAt: new Date('2026-01-02T00:00:00Z'),
    },
    correctiveActions: [
      {
        type: 'CORRECTIVE',
        description: 'Roll back the deploy',
        ownerName: 'Yossi Levi',
        dueDate: null,
        isComplete: true,
      },
      {
        type: 'PREVENTIVE',
        description: 'Add a saturation alert on the DB pool',
        ownerName: 'Dana Cohen',
        dueDate: new Date('2026-01-15T00:00:00Z'),
        isComplete: false,
      },
    ],
  };

  it('includes the incident title, severity, and service in the header', () => {
    const markdown = generator.generateMarkdown(baseInput);
    expect(markdown).toContain(
      '# Root Cause Analysis: Elevated 5xx rate on outbound wire submission',
    );
    expect(markdown).toContain('Payments Gateway');
    expect(markdown).toContain('SEV1');
  });

  it('computes time-to-acknowledge and time-to-recover from the incident timestamps', () => {
    const markdown = generator.generateMarkdown(baseInput);
    expect(markdown).toContain('| Time to Acknowledge | 5 min |');
    expect(markdown).toContain('| Time to Recover | 65 min |');
  });

  it('renders every timeline entry in order', () => {
    const markdown = generator.generateMarkdown(baseInput);
    const createdIndex = markdown.indexOf('Incident opened at SEV1');
    const ackIndex = markdown.indexOf('Incident acknowledged');
    expect(createdIndex).toBeGreaterThan(-1);
    expect(ackIndex).toBeGreaterThan(createdIndex);
  });

  it('splits corrective and preventive actions into separate sections', () => {
    const markdown = generator.generateMarkdown(baseInput);
    const correctiveSection = markdown.indexOf('## Corrective Actions');
    const preventiveSection = markdown.indexOf('## Preventive Actions');
    expect(correctiveSection).toBeLessThan(preventiveSection);
    expect(markdown.slice(correctiveSection, preventiveSection)).toContain('Roll back the deploy');
    expect(markdown.slice(preventiveSection)).toContain('Add a saturation alert on the DB pool');
  });

  it('formats the root cause category as title case', () => {
    const markdown = generator.generateMarkdown(baseInput);
    expect(markdown).toContain('**Category:** Configuration Change');
  });

  it('renders "Pending review" when there is no reviewer yet', () => {
    const markdown = generator.generateMarkdown({
      ...baseInput,
      report: { ...baseInput.report, status: 'IN_REVIEW', reviewedByName: null, publishedAt: null },
    });
    expect(markdown).toContain('_Pending review._');
  });

  it('handles an empty timeline and no corrective actions gracefully', () => {
    const markdown = generator.generateMarkdown({
      ...baseInput,
      timeline: [],
      correctiveActions: [],
    });
    expect(markdown).toContain('_No timeline events recorded._');
    expect(markdown).toContain('_None recorded._');
  });
});
