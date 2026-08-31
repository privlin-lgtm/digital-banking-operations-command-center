import type { IncidentContext, TimelineEntry } from './incident-context-reader.js';

export interface CorrectiveActionSummary {
  type: string;
  description: string;
  ownerName: string;
  dueDate: Date | null;
  isComplete: boolean;
}

export interface RcaReportSummary {
  status: string;
  rootCause: string;
  rootCauseCategory: string;
  contributingFactors: string | null;
  authoredByName: string;
  reviewedByName: string | null;
  publishedAt: Date | null;
}

export interface RcaDocumentInput {
  incident: IncidentContext;
  timeline: TimelineEntry[];
  report: RcaReportSummary;
  correctiveActions: CorrectiveActionSummary[];
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—';
}

function minutesBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) {
    return null;
  }
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

function formatCategory(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Pure formatting — no I/O, no database. Takes the already-gathered
 * incident context, reconstructed timeline, RCA fields, and corrective
 * actions, and renders the Markdown document a stakeholder would
 * actually read. Keeping this separate from IncidentContextReader (the
 * I/O side) is what makes report *formatting* testable with plain
 * object literals, same as EscalationEngine and SlaCalculator.
 */
export class RcaReportGenerator {
  generateMarkdown(input: RcaDocumentInput): string {
    const { incident, timeline, report, correctiveActions } = input;
    const mttd = minutesBetween(incident.openedAt, incident.acknowledgedAt);
    const mttr = minutesBetween(incident.openedAt, incident.resolvedAt);

    const corrective = correctiveActions.filter((action) => action.type === 'CORRECTIVE');
    const preventive = correctiveActions.filter((action) => action.type === 'PREVENTIVE');

    const lines: string[] = [];
    lines.push(`# Root Cause Analysis: ${incident.title}`);
    lines.push('');
    lines.push(
      `**Status:** ${report.status}  |  **Severity:** ${incident.severity}  |  **Service:** ${incident.primaryServiceName}`,
    );
    lines.push('');
    lines.push('## Incident Summary');
    lines.push('');
    lines.push('| Field | Value |');
    lines.push('| --- | --- |');
    lines.push(`| Incident Commander | ${incident.commanderName ?? '_unassigned_'} |`);
    lines.push(`| Opened | ${formatDate(incident.openedAt)} |`);
    lines.push(`| Acknowledged | ${formatDate(incident.acknowledgedAt)} |`);
    lines.push(`| Resolved | ${formatDate(incident.resolvedAt)} |`);
    lines.push(`| Closed | ${formatDate(incident.closedAt)} |`);
    lines.push(`| Time to Acknowledge | ${mttd !== null ? `${mttd} min` : '—'} |`);
    lines.push(`| Time to Recover | ${mttr !== null ? `${mttr} min` : '—'} |`);
    lines.push('');

    lines.push('## Timeline Reconstruction');
    lines.push('');
    if (timeline.length === 0) {
      lines.push('_No timeline events recorded._');
    } else {
      for (const entry of timeline) {
        const actor = entry.actorName ?? 'system';
        lines.push(`- **${formatDate(entry.at)}** (${actor}) — ${entry.summary}`);
      }
    }
    lines.push('');

    lines.push('## Root Cause');
    lines.push('');
    lines.push(`**Category:** ${formatCategory(report.rootCauseCategory)}`);
    lines.push('');
    lines.push(report.rootCause);
    lines.push('');

    lines.push('## Contributing Factors');
    lines.push('');
    lines.push(report.contributingFactors ?? '_None recorded._');
    lines.push('');

    lines.push('## Corrective Actions');
    lines.push('');
    lines.push(...this.renderActionTable(corrective));
    lines.push('');

    lines.push('## Preventive Actions');
    lines.push('');
    lines.push(...this.renderActionTable(preventive));
    lines.push('');

    lines.push('## Review');
    lines.push('');
    lines.push(`Authored by **${report.authoredByName}**.`);
    lines.push(
      report.reviewedByName
        ? `Reviewed and approved by **${report.reviewedByName}**${report.publishedAt ? ` on ${formatDate(report.publishedAt)}` : ''}.`
        : '_Pending review._',
    );

    return lines.join('\n');
  }

  private renderActionTable(actions: CorrectiveActionSummary[]): string[] {
    if (actions.length === 0) {
      return ['_None recorded._'];
    }
    const rows = ['| Description | Owner | Due | Status |', '| --- | --- | --- | --- |'];
    for (const action of actions) {
      rows.push(
        `| ${action.description} | ${action.ownerName} | ${action.dueDate ? formatDate(action.dueDate) : '—'} | ${action.isComplete ? '✅ Complete' : '⏳ Open'} |`,
      );
    }
    return rows;
  }
}
