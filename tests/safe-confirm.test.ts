import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHoldProgress, createActionGate, isValidDoubleClick, validateTypeConfirmation } from '../src/services/safeConfirmLogic';

test('releasing before the hold duration never completes confirmation', () => {
  assert.deepEqual(calculateHoldProgress(0, 2), { progress: 0, remainingSeconds: 2, isCompleted: false });
  assert.equal(calculateHoldProgress(1999, 2).isCompleted, false);
  assert.deepEqual(calculateHoldProgress(2000, 2), { progress: 1, remainingSeconds: 0, isCompleted: true });
});

test('typed confirmation retains existing case-insensitive exact checks', () => {
  assert.equal(validateTypeConfirmation(' herstel ', 'HERSTEL'), true);
  assert.equal(validateTypeConfirmation('herstel nu', 'HERSTEL'), false);
  assert.equal(validateTypeConfirmation('', 'HERSTEL'), false);
});

test('double-click needs two distinct clicks inside the configured window', () => {
  assert.equal(isValidDoubleClick(1000, 1050), false);
  assert.equal(isValidDoubleClick(1000, 1051), true);
  assert.equal(isValidDoubleClick(1000, 4500), true);
  assert.equal(isValidDoubleClick(1000, 4501), false);
});

test('an action gate admits a confirmation only once until completion', () => {
  const gate = createActionGate();
  assert.equal(gate.enter(), true);
  assert.equal(gate.enter(), false);
  assert.equal(gate.running, true);
  gate.leave();
  assert.equal(gate.enter(), true);
});
