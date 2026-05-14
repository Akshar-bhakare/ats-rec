// backend/src/tests/interviewScheduleErrorTest/webRTCRoutes.Test.js

// TEST COVERAGE:
// - WebSocket route: GET /api/webrtc/rooms/:roomId
// - Room join and isolation by roomId
// - Message handling: invalid JSON, valid broadcast, no self-echo, fan-out
// - Safe handling of closed/non-OPEN peers
// - Disconnect cleanup without crashes
// - Binary and large payload robustness

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';

import webrtcRoomRoutes from '../../routes/VirtualInterview/webrtcRoomRoutes.js';

/**
 * Pretty console logs for what each test is validating
 */
function logTest(title, steps = []) {
  console.log(`\n[TEST] ${title}`);
  for (const s of steps) console.log(`  - ${s}`);
}

/**
 * Helper: wait for an event once with timeout
 */
function onceWithTimeout(emitter, event, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for "${event}"`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(t);
      emitter.removeListener(event, onEvent);
      emitter.removeListener('error', onError);
    }

    function onEvent(...args) {
      cleanup();
      resolve(args);
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    emitter.on(event, onEvent);
    emitter.on('error', onError);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function connectWs(url) {
  const ws = new WebSocket(url);
  await onceWithTimeout(ws, 'open', 2500);
  return ws;
}

async function expectNoMessage(ws, waitMs = 700) {
  let got = false;
  const onMsg = () => {
    got = true;
  };
  ws.on('message', onMsg);
  await sleep(waitMs);
  ws.off('message', onMsg);
  assert.equal(got, false, 'Expected no message but got one');
}

let fastify;
let baseUrl;

/**
 * IMPORTANT:
 * node:test runs tests concurrently by default.
 * We share a single Fastify server across tests, so we must run serially.
 */
describe('webrtcRoomRoutes - error handling (serial)', { concurrency: 1 }, () => {
  test('setup server', async () => {
    logTest('Setup Fastify + WebSocket + WebRTC room routes', [
      'Register @fastify/websocket',
      'Register webrtcRoomRoutes plugin',
      'Listen on ephemeral port and build ws baseUrl',
    ]);

    fastify = Fastify({ logger: false });

    await fastify.register(websocket);
    await fastify.register(webrtcRoomRoutes);

    await fastify.listen({ port: 0, host: '127.0.0.1' });
    const addr = fastify.server.address();
    baseUrl = `ws://127.0.0.1:${addr.port}`;

    assert.ok(baseUrl.includes('ws://127.0.0.1:'), 'baseUrl should be set');
    console.log(`  ✅ baseUrl = ${baseUrl}`);
  });

  test('invalid JSON message should NOT crash and should NOT broadcast to peers', async () => {
    logTest('Invalid JSON handling', [
      'Connect Client A and Client B to same room',
      'Client A sends invalid JSON string',
      'Server should ignore it and NOT broadcast to B',
      'Then A sends valid JSON and B MUST receive it',
    ]);

    const roomId = `room-invalid-json-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);
    const b = await connectWs(url);

    // Invalid JSON from A
    a.send('NOT_JSON');

    // B should not receive anything
    await expectNoMessage(b);

    // Ensure connection still works with valid JSON
    const payload = { type: 'ping', t: Date.now() };
    const waitB = onceWithTimeout(b, 'message', 2500);

    a.send(JSON.stringify(payload));

    const [raw] = await waitB;
    assert.deepEqual(JSON.parse(raw.toString()), payload);

    a.terminate();
    b.terminate();
  });

  test('should NOT echo messages back to sender (no self-broadcast)', async () => {
    logTest('No self-broadcast', [
      'Connect single client to room',
      'Client sends valid JSON',
      'Server must NOT echo message back to same client',
    ]);

    const roomId = `room-no-echo-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);

    const payload = { type: 'offer', sdp: 'fake-sdp' };
    a.send(JSON.stringify(payload));

    await expectNoMessage(a);

    a.terminate();
  });

  test('sending to a room where peer is already closed should not throw / crash', async () => {
    logTest('Safe handling when peer disconnects', [
      'Connect Client A and B to same room',
      'Terminate B',
      'A sends signaling message',
      'Server should skip non-OPEN sockets and not crash (A stays OPEN)',
    ]);

    const roomId = `room-peer-closed-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);
    const b = await connectWs(url);

    // Terminate B and ensure it closes
    const waitB = onceWithTimeout(b, 'close', 5000);
    b.terminate();
    await waitB;

    // Now A sends signaling message; server should handle safely
    a.send(JSON.stringify({ type: 'candidate', candidate: 'fake' }));

    assert.equal(a.readyState, WebSocket.OPEN);
    await sleep(250);
    assert.equal(a.readyState, WebSocket.OPEN);

    a.terminate();
  });

  test('disconnect cleanup: closing clients should not error (close handler safe)', async () => {
    logTest('Cleanup on disconnect', [
      'Connect 2 clients in same room',
      'Attach close listeners FIRST (avoid missing close event)',
      'Terminate both clients',
      'Both must emit close (no hangs / no crashes)',
    ]);

    const roomId = `room-cleanup-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);
    const b = await connectWs(url);

    // Attach waits BEFORE terminating to avoid missing 'close'
    const waitA = onceWithTimeout(a, 'close', 5000);
    const waitB = onceWithTimeout(b, 'close', 5000);

    a.terminate();
    b.terminate();

    await Promise.all([waitA, waitB]);

    assert.ok(true);
  });

  test('broadcast should reach all other peers in the room (fan-out)', async () => {
    logTest('Broadcast fan-out', [
      'Connect A, B, C to same room',
      'A sends a signaling payload',
      'B and C must receive the exact payload',
    ]);

    const roomId = `room-fanout-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);
    const b = await connectWs(url);
    const c = await connectWs(url);

    const payload = { type: 'offer', sdp: 'fanout-sdp', t: Date.now() };

    const waitB = onceWithTimeout(b, 'message', 2500);
    const waitC = onceWithTimeout(c, 'message', 2500);

    a.send(JSON.stringify(payload));

    const [rawB] = await waitB;
    const [rawC] = await waitC;

    assert.deepEqual(JSON.parse(rawB.toString()), payload);
    assert.deepEqual(JSON.parse(rawC.toString()), payload);

    a.terminate();
    b.terminate();
    c.terminate();
  });

  test('room isolation: messages must not leak to other rooms', async () => {
    logTest('Room isolation', [
      'Connect A and B in room1',
      'Connect C in room2',
      'A sends message -> B receives',
      'C must NOT receive anything',
    ]);

    const room1 = `room-iso-1-${Date.now()}`;
    const room2 = `room-iso-2-${Date.now()}`;

    const url1 = `${baseUrl}/api/webrtc/rooms/${room1}`;
    const url2 = `${baseUrl}/api/webrtc/rooms/${room2}`;

    const a = await connectWs(url1);
    const b = await connectWs(url1);
    const c = await connectWs(url2);

    const payload = { type: 'candidate', candidate: 'iso', t: Date.now() };

    const waitB = onceWithTimeout(b, 'message', 2500);
    a.send(JSON.stringify(payload));

    const [rawB] = await waitB;
    assert.deepEqual(JSON.parse(rawB.toString()), payload);

    await expectNoMessage(c);

    a.terminate();
    b.terminate();
    c.terminate();
  });

  test('binary message should be treated as invalid JSON and not broadcast', async () => {
    logTest('Binary input handling', [
      'Connect A and B in same room',
      'A sends binary payload (Buffer)',
      'Server should fail JSON parse and NOT broadcast to B',
    ]);

    const roomId = `room-binary-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);
    const b = await connectWs(url);

    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    a.send(buf);

    await expectNoMessage(b);

    a.terminate();
    b.terminate();
  });

  test('large signaling payload should not crash and should broadcast', async () => {
    logTest('Large payload handling', [
      'Connect A and B in same room',
      'A sends a large JSON payload',
      'B receives it (server does not crash)',
    ]);

    const roomId = `room-large-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);
    const b = await connectWs(url);

    const bigString = 'x'.repeat(200_000); // ~200KB
    const payload = { type: 'offer', sdp: bigString, t: Date.now() };

    const waitB = onceWithTimeout(b, 'message', 7000);

    a.send(JSON.stringify(payload));

    const [rawB] = await waitB;
    const parsed = JSON.parse(rawB.toString());

    assert.equal(parsed.type, payload.type);
    assert.equal(parsed.t, payload.t);
    assert.equal(parsed.sdp.length, bigString.length);

    a.terminate();
    b.terminate();
  });

  test('client sending after terminate should not break server (client-side error only)', async () => {
    logTest('Send-after-close behavior', [
      'Connect A and B',
      'Terminate A, then attempt to send (may throw client-side)',
      'Server should remain up (B still open briefly)',
    ]);

    const roomId = `room-send-after-close-${Date.now()}`;
    const url = `${baseUrl}/api/webrtc/rooms/${roomId}`;

    const a = await connectWs(url);
    const b = await connectWs(url);

    const waitA = onceWithTimeout(a, 'close', 5000);
    a.terminate();
    await waitA;

    // ws may throw here; we swallow because we are testing robustness
    try {
      a.send(JSON.stringify({ type: 'late' }));
    } catch (e) {
      // expected sometimes
    }

    assert.equal(b.readyState, WebSocket.OPEN);

    b.terminate();
  });

  test('teardown server', async () => {
    logTest('Teardown server', ['Close Fastify instance cleanly']);
    if (fastify) await fastify.close();
  });
});