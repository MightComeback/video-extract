import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Oppo', () => {
    const transcript = "The app freezes on my Oppo Find X5.";
    const brief = renderBrief({ transcript });
    assert.match(brief, /- Browser \/ OS: .*Oppo.*/);
});

test('MIG-14: extractEnvironment detects Vivo', () => {
    const transcript = "I can reproduce this on Vivo X90.";
    const brief = renderBrief({ transcript });
    assert.match(brief, /- Browser \/ OS: .*Vivo.*/);
});

test('MIG-14: extractEnvironment detects Realme', () => {
    const transcript = "My Realme GT 2 is overheating.";
    const brief = renderBrief({ transcript });
    assert.match(brief, /- Browser \/ OS: .*Realme.*/);
});
