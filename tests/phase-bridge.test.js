import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GSDPhaseBridge } from '../src/gsd/phase-bridge.js';
import { TEMPLATE_LAW_NAMES } from '../src/core/templates.js';
import { runNewProject } from '../src/cli/new-project.js';
import { runMapCodebase } from '../src/cli/map-codebase.js';
import { runDiscuss } from '../src/cli/discuss.js';
import { runPlan } from '../src/cli/plan.js';
import { runExecute } from '../src/cli/execute.js';
import { runVerify } from '../src/cli/verify.js';
import { runShip } from '../src/cli/ship.js';
import { runStatus } from '../src/cli/status.js';

describe('GSD Phase Bridge & Full Lifecycle', () => {
  test('complete GSD Core lifecycle: new-project -> map -> discuss -> plan -> execute -> verify -> ship', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lifecycle-'));

    // 1. New Project
    const newProjRes = runNewProject('test-vault', { projectRoot: tmpDir });
    assert.strictEqual(newProjRes.success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, 'LAWS.bend')), true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, 'PROOF.bend')), true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'laws.lock')), true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'STATE.md')), true);

    // 2. Map Codebase
    // Create a dummy source file with state keywords
    fs.writeFileSync(path.join(tmpDir, 'wallet.js'), 'export function withdraw(balance, amount) { return balance - amount; }', 'utf8');
    const mapRes = runMapCodebase({ projectRoot: tmpDir });
    assert.strictEqual(mapRes.success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'CODEBASE_MAP.md')), true);
    assert.strictEqual(mapRes.candidates.some(c => c.path.includes('wallet.js')), true);

    // 3. Discuss
    const discussRes = runDiscuss('Wallet Solvency Guarantees', { projectRoot: tmpDir, notes: 'Must prevent underflows' });
    assert.strictEqual(discussRes.success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'DISCUSS.md')), true);

    // 4. Plan
    const planRes = runPlan({ projectRoot: tmpDir });
    assert.strictEqual(planRes.success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'PLAN.md')), true);
    assert.strictEqual(planRes.lockData.laws.includes(TEMPLATE_LAW_NAMES[0]), true);

    // 5. Execute - Check law integrity
    const execRes = runExecute({ projectRoot: tmpDir });
    assert.strictEqual(execRes.success, true);
    assert.strictEqual(execRes.activeLaws.includes(TEMPLATE_LAW_NAMES[0]), true);

    // Verify ship is blocked BEFORE verify
    const shipBlocked = runShip({ projectRoot: tmpDir });
    assert.strictEqual(shipBlocked.success, false);
    assert.strictEqual(shipBlocked.error, 'GATE_BLOCKED');

    // 6. Verify - Run formal verification gate
    const verifyRes = runVerify({ projectRoot: tmpDir });
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'PROOF_ATTESTATION.json')), true);

    // 7. Ship - Now should succeed
    const shipPassed = runShip({ projectRoot: tmpDir });
    assert.strictEqual(shipPassed.success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, '.planning', 'SHIP_SUMMARY.md')), true);
    assert.strictEqual(shipPassed.state.currentPhase, 'ship');
    assert.strictEqual(shipPassed.state.status, 'completed');

    // 8. Status check
    const statusRes = runStatus({ projectRoot: tmpDir });
    assert.strictEqual(statusRes.success, true);
    assert.strictEqual(statusRes.lockIntegrity, true);
    assert.strictEqual(statusRes.attestationValid, true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('execute phase blocks when LAWS.bend is tampered with', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-tamper-'));
    runNewProject('tamper-test', { projectRoot: tmpDir });

    // Tamper with LAWS.bend
    fs.appendFileSync(path.join(tmpDir, 'LAWS.bend'), '\n# malicious cheat comment\nlaw malicious_bypass:\n  { True == True : Bool }\n', 'utf8');

    const execRes = GSDPhaseBridge.execute(tmpDir);
    assert.strictEqual(execRes.success, false);
    assert.strictEqual(execRes.error, 'LAW_LOCK_TAMPERED');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('STATE.md fallback correctly strips markdown backticks and asterisks', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-state-md-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

    // Write STATE.md with markdown formatting and no state.json
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), `# GSD Project State\n\n**Current Phase:** \`ship\`  \n**Status:** \`completed\`  \n`, 'utf8');

    const state = GSDPhaseBridge.getGSDState(tmpDir);
    assert.strictEqual(state.currentPhase, 'ship');
    assert.strictEqual(state.status, 'completed');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('canAdvanceToShip blocks if PROOF.bend is tampered with post-attestation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-tamper-proof-'));
    runNewProject('tamper-proof-test', { projectRoot: tmpDir });
    runPlan({ projectRoot: tmpDir });
    runExecute({ projectRoot: tmpDir });

    const verifyRes = runVerify({ projectRoot: tmpDir });
    assert.strictEqual(verifyRes.success, true);

    // Verify initially passes ship gate
    const gateBefore = GSDPhaseBridge.canAdvanceToShip(tmpDir);
    assert.strictEqual(gateBefore.canAdvance, true);

    // Tamper with PROOF.bend post-verification!
    fs.appendFileSync(path.join(tmpDir, 'PROOF.bend'), '\n# sneaky injection after verify passed!\n', 'utf8');

    // Ship gate MUST detect post-attestation tampering and block
    const gateAfter = GSDPhaseBridge.canAdvanceToShip(tmpDir);
    assert.strictEqual(gateAfter.canAdvance, false);
    assert.match(gateAfter.reason, /PROOF\.bend has been modified/);

    const shipRes = runShip({ projectRoot: tmpDir });
    assert.strictEqual(shipRes.success, false);
    assert.strictEqual(shipRes.error, 'GATE_BLOCKED');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getStatus accurately steps through plan -> execute -> verify -> ship -> done', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-steps-'));
    runNewProject('step-test', { projectRoot: tmpDir });

    // After plan, next recommended step must be execute (NOT verify!)
    runPlan({ projectRoot: tmpDir });
    const statusAfterPlan = GSDPhaseBridge.getStatus(tmpDir);
    assert.strictEqual(statusAfterPlan.nextStep, 'execute');

    // After execute, next step must be verify
    runExecute({ projectRoot: tmpDir });
    const statusAfterExec = GSDPhaseBridge.getStatus(tmpDir);
    assert.strictEqual(statusAfterExec.nextStep, 'verify');

    // After verify, next step must be ship
    runVerify({ projectRoot: tmpDir });
    const statusAfterVerify = GSDPhaseBridge.getStatus(tmpDir);
    assert.strictEqual(statusAfterVerify.nextStep, 'ship');

    // After ship, next step must be done
    runShip({ projectRoot: tmpDir });
    const statusAfterShip = GSDPhaseBridge.getStatus(tmpDir);
    assert.strictEqual(statusAfterShip.nextStep, 'done');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('GSDPhaseBridge.next accurately routes lifecycle phases', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-next-test-'));

    // 1. Uninitialized -> recommends new-project
    const nextInit = GSDPhaseBridge.next(tmpDir);
    assert.strictEqual(nextInit.nextStep, 'new-project');

    // 2. Initialize project
    runNewProject('next-demo', { projectRoot: tmpDir });
    const nextMap = GSDPhaseBridge.next(tmpDir);
    assert.strictEqual(nextMap.nextStep, 'map-codebase');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
