import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import RedactedReporter from './redacted-reporter.ts';

test('redacts capabilities in errors and text attachments without changing safe text', () => {
  const capability = 'x'.repeat(43);
  const result = {
    errors: [{ message: `access=${capability}`, stack: capability, snippet: capability }],
    attachments: [{ contentType: 'text/plain', body: Buffer.from(`safe ${capability}`) }],
  };
  new RedactedReporter().onTestEnd({}, result);
  assert.equal(result.errors[0].message, 'access=[REDACTED]');
  assert.equal(result.errors[0].stack, '[REDACTED]');
  assert.equal(result.errors[0].snippet, '[REDACTED]');
  assert.equal(result.attachments[0].body.toString(), 'safe [REDACTED]');
});
