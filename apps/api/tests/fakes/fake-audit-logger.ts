import type { AuditEntry, AuditLogger } from '../../src/modules/audit/audit-logger.js';

/** Records every call instead of writing anywhere, so a test can assert on `entries`. */
export class FakeAuditLogger implements AuditLogger {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
