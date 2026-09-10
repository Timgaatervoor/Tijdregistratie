import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceInviteEmail } from '../src/services/deviceInviteEmail';

test('email preserves the complete invitation URL and code through mailto encoding', () => {
  const invitation = { link: 'https://example.test/app/?x=1&y=2#join=abc+/==', code: '1234567890abcdef' };
  const email = deviceInviteEmail(invitation);
  const params = new URLSearchParams(email.mailto.split('?')[1]);
  assert.equal(params.get('subject'), email.subject);
  assert.equal(params.get('body'), email.body);
  assert.ok(email.body.includes(invitation.link));
  assert.ok(email.body.includes(invitation.code));
  assert.ok(email.body.includes('10 minuten'));
});

test('localhost invitations explain how to use the link on a second local installation', () => {
  const email = deviceInviteEmail({ link: 'http://localhost:3000/#join=abc', code: 'test' });
  assert.ok(email.body.includes('Start eerst Tijdregistratie op het tweede toestel'));
  assert.ok(email.body.includes('volledige link'));
});
