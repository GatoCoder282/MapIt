import { readFileSync, writeFileSync } from 'node:fs';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

// Playwright error-context snapshots include link hrefs, even with trace/screenshots off.
const redact = (text: string): string => text.replace(/[A-Za-z0-9_-]{43,}/g, '[REDACTED]');

export default class RedactedReporter implements Reporter {
  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const error of result.errors) {
      if (error.message) error.message = redact(error.message);
      if (error.stack) error.stack = redact(error.stack);
      if (error.snippet) error.snippet = redact(error.snippet);
    }
    for (const attachment of result.attachments) {
      if (!/text|json/.test(attachment.contentType)) continue;
      if (attachment.body) attachment.body = Buffer.from(redact(attachment.body.toString('utf8')));
      if (attachment.path)
        writeFileSync(attachment.path, redact(readFileSync(attachment.path, 'utf8')));
    }
  }
}
