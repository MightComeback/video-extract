import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

function getOsLine(brief) {
  return brief.split('\n').find(l => l.startsWith('- Browser / OS:')) || '';
}

describe('extractEnvironment items', () => {
  it('detects CentOS', () => {
    const brief = renderBrief({ transcript: "I am running this on CentOS 7 and it fails." });
    const line = getOsLine(brief);
    assert.ok(line.includes('CentOS'), `Expected CentOS in OS line, got: ${line}`);
  });

  it('detects Mint', () => {
    const brief = renderBrief({ transcript: "Tested on Linux Mint 21." });
    const line = getOsLine(brief);
    assert.ok(line.includes('Mint'), `Expected Mint in OS line, got: ${line}`);
  });

  it('detects Surface device', () => {
    const brief = renderBrief({ transcript: "My Surface Pro 7 is overheating." });
    const line = getOsLine(brief);
    assert.ok(line.includes('Surface'), `Expected Surface in OS line, got: ${line}`);
  });
});
