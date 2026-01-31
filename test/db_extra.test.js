import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

describe('MIG-14: Database keywords extensions', () => {
  it('detects Prisma as a database issue', () => {
    const transcript = "The prisma client failed to connect.";
    const actions = generateNextActions(transcript, []);
    assert.match(actions.join('\n'), /Check database state \/ migrations/);
  });

  it('detects Drizzle as a database issue', () => {
    const transcript = "Drizzle ORM threw an error during migration.";
    const actions = generateNextActions(transcript, []);
    assert.match(actions.join('\n'), /Check database state \/ migrations/);
  });

  it('detects MySQL explicitly', () => {
    const transcript = "MySQL connection timed out.";
    const actions = generateNextActions(transcript, []);
    assert.match(actions.join('\n'), /Check database state \/ migrations/);
  });

  it('detects SQLite explicitly', () => {
    const transcript = "SQLite database is locked.";
    const actions = generateNextActions(transcript, []);
    assert.match(actions.join('\n'), /Check database state \/ migrations/);
  });
});
