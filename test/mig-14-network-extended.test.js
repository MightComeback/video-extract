import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects DNS/Resolution errors', () => {
    const result = generateNextActions('We saw a DNS_PROBE_FINISHED_NXDOMAIN error.');
    assert.ok(result.some(a => a.includes('Check DNS records') || a.includes('Check network connectivity')), 'Should suggest check for DNS');
});

test('MIG-14: generateNextActions detects Connection Refused', () => {
    const result = generateNextActions('The connection was refused by the server (ECONNREFUSED).');
    assert.ok(result.some(a => a.includes('Check port binding') || a.includes('Check firewall rules') || a.includes('Check server availability')), 'Should suggest checking port/firewall/server');
});

test('MIG-14: generateNextActions detects SSL/TLS Handshake failures', () => {
  const inputs = [
    'CERT_HAS_EXPIRED',
    'self signed certificate',
    'SSL handshake failed',
    'ERR_CERT_COMMON_NAME_INVALID'
  ];
  for (const input of inputs) {
    const result = generateNextActions(`It failed with ${input}.`);
    assert.ok(result.some(a => a.includes('Check SSL/TLS certificates') || a.includes('Check clock synchronization')), `Should handle ${input}`);
  }
});

test('MIG-14: generateNextActions detects offline/network issues', () => {
  const result = generateNextActions('The user appears to be offline or network is down.');
  assert.ok(result.some(a => a.includes('Check network connectivity') || a.includes('Check VPN status')), 'Should suggest checking network/VPN');
});
