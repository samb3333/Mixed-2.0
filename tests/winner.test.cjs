const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { togglePlayerRole } = require('../dist/classes/OrionApi');
const { PlayerManager } = require('../dist/classes/PlayerManager');
const winner = require('../dist/commands/Public/winner');

const fleet = '1c74c4a2-b3b0-407d-b30a-f0ec6538a397';
const role = 'c9305c3d-14e7-489a-a4f6-bf1f49b86fb9';
const allowedRoles = ['1542454339661074452', '1542454457197924402'];
const originalFetch = global.fetch;
const originalKey = process.env.ORION_API_KEY;
const originalFleet = process.env.WINNER_FLEET_ID;
let requests;
let responses;
let player;

beforeEach(() => {
  process.env.ORION_API_KEY = 'test-orion-key';
  delete process.env.WINNER_FLEET_ID;
  requests = [];
  responses = [];
  player = { username: 'Nova' };
  mock.method(PlayerManager, 'getInstance', () => ({ get: () => player }));
  global.fetch = async (url, init) => {
    requests.push({ url, ...init });
    assert.equal(init.headers['x-api-key'], 'test-orion-key');
    assert.ok(init.signal instanceof AbortSignal);
    assert.ok(responses.length, 'Unexpected extra API request');
    const next = responses.shift();
    return typeof next === 'function' ? next() : next;
  };
});

afterEach(() => {
  global.fetch = originalFetch;
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.ORION_API_KEY;
  else process.env.ORION_API_KEY = originalKey;
  if (originalFleet === undefined) delete process.env.WINNER_FLEET_ID;
  else process.env.WINNER_FLEET_ID = originalFleet;
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const toggle = (username = 'Nova') => togglePlayerRole(fleet, role, username);

function interaction(roles = [allowedRoles[0]]) {
  return {
    user: { id: 'discord-user' },
    guild: {
      members: {
        fetch: async options => {
          assert.deepEqual(options, { user: 'discord-user', force: true });
          return { roles: { cache: new Set(roles) } };
        },
      },
    },
    deferReply: async options => assert.equal(options.ephemeral, true),
    editReply: async content => content,
  };
}

test('adds Winner by saved username when the live member list does not contain it', async () => {
  responses.push(json({ users: [{ user_id: 'other', username: 'SomeoneElse' }] }), json({ success: true, user_exists: true }));
  assert.equal(await toggle(' Nova '), 'added');
  assert.equal(requests[0].url, `https://api.oriondrift.net/v2/fleets/${fleet}/roles/${role}/users`);
  assert.equal(requests[1].url, `https://api.oriondrift.net/v2/fleets/${fleet}/user_roles`);
  assert.equal(requests[1].method, 'POST');
  assert.deepEqual(JSON.parse(requests[1].body), { username: 'Nova', role_id: role, expires_hours: 0 });
});

for (const wrapper of ['users', 'items', 'array']) {
  test(`removes only Winner using the exact player ID from a ${wrapper} response`, async () => {
    const users = [{ user_id: '9128452633859618123', username: 'NOVA' }];
    responses.push(json(wrapper === 'array' ? users : { [wrapper]: users }), json({ success: true }));
    assert.equal(await toggle(), 'removed');
    assert.equal(requests[1].url, `https://api.oriondrift.net/v1/fleets/${fleet}/users/9128452633859618123/role/${role}`);
    assert.equal(requests[1].method, 'DELETE');
    assert.equal(requests[1].body, undefined);
  });
}

test('supports the documented id/display_name member aliases', async () => {
  responses.push(json({ users: [{ id: '123', display_name: 'Nova' }] }), json({ success: true }));
  assert.equal(await toggle(), 'removed');
});

for (const data of [
  {}, { users: null }, { users: [null] },
  { users: [{ user_id: 9128452633859618, username: 'Nova' }] },
  { users: [{ user_id: '123' }] },
  { users: [], page: { pages: 2, page: 1 } },
  { users: [{ user_id: '1', username: 'Nova' }, { user_id: '2', username: 'nova' }] },
]) {
  test(`does not mutate roles when membership is malformed, partial, or ambiguous: ${JSON.stringify(data)}`, async () => {
    responses.push(json(data));
    await assert.rejects(toggle(), { code: 'invalid_response' });
    assert.equal(requests.length, 1);
  });
}

for (const status of [401, 403, 429, 500]) {
  test(`does not mutate roles after a membership HTTP ${status}`, async () => {
    responses.push(json({ error: 'failure' }, status));
    await assert.rejects(toggle(), { code: status === 401 || status === 403 ? 'permission' : 'request' });
    assert.equal(requests.length, 1);
  });
}

test('handles unknown players even when assignment returns HTTP 200', async () => {
  responses.push(json({ users: [] }), json({ success: true, user_exists: false }));
  await assert.rejects(toggle(), { code: 'player_not_found' });
});

test('does not claim success for an unsuccessful mutation response', async () => {
  responses.push(json({ users: [] }), json({ success: false, user_exists: true }));
  await assert.rejects(toggle(), { code: 'invalid_response' });
  responses.push(json({ users: [{ user_id: '123', username: 'Nova' }] }), json({ success: false }));
  await assert.rejects(toggle(), { code: 'invalid_response' });
});

test('does not retry an uncertain network failure and releases the lock', async () => {
  responses.push(json({ users: [] }), () => { throw new Error('connection lost'); });
  await assert.rejects(toggle(), { code: 'unavailable' });
  assert.equal(requests.length, 2);
  responses.push(json({ users: [{ user_id: '123', username: 'Nova' }] }), json({ success: true }));
  assert.equal(await toggle(), 'removed');
});

test('rejects overlapping requests for the same player, regardless of username case', async () => {
  let release;
  responses.push(() => new Promise(resolve => { release = resolve; }), json({ success: true, user_exists: true }));
  const pending = toggle();
  assert.equal(await toggle(' NOVA '), 'busy');
  assert.equal(requests.length, 1);
  release(json({ users: [] }));
  assert.equal(await pending, 'added');
});

for (const allowed of allowedRoles) {
  test(`allows Discord role ${allowed} on its own`, async () => {
    responses.push(json({ users: [] }), json({ success: true, user_exists: true }));
    assert.equal(await winner.execute(interaction([allowed])), 'Winner enabled for your saved player.');
  });
}

test('denies other Discord roles without calling Orion', async () => {
  assert.match(await winner.execute(interaction(['unrelated-role'])), /eligible Discord roles/);
  assert.equal(requests.length, 0);
});

test('rejects DMs and failed Discord membership checks without calling Orion', async () => {
  const dm = interaction();
  dm.guild = null;
  assert.match(await winner.execute(dm), /in the server/);
  const unavailable = interaction();
  unavailable.guild.members.fetch = async () => { throw new Error('Discord unavailable'); };
  assert.match(await winner.execute(unavailable), /Could not check/);
  assert.equal(requests.length, 0);
});

test('asks unregistered players to save a username before any API call', async () => {
  player = undefined;
  assert.match(await winner.execute(interaction()), /edit_username/);
  player = { username: ' ' };
  assert.match(await winner.execute(interaction()), /edit_username/);
  assert.equal(requests.length, 0);
});

test('reports missing configuration without any API call', async () => {
  delete process.env.ORION_API_KEY;
  assert.match(await winner.execute(interaction()), /ORION_API_KEY/);
  assert.equal(requests.length, 0);
});

test('reports permission errors and nonexistent saved players', async () => {
  responses.push(json({}, 401));
  assert.match(await winner.execute(interaction()), /fleet permissions/);
  responses.push(json({ users: [] }), json({ success: true, user_exists: false }));
  assert.match(await winner.execute(interaction()), /could not find your saved player/);
});

test('uses a configured fleet override and privately confirms removal', async () => {
  process.env.WINNER_FLEET_ID = 'configured-fleet';
  responses.push(json({ users: [{ user_id: '123', username: 'Nova' }] }), json({ success: true }));
  assert.equal(await winner.execute(interaction()), 'Winner disabled for your saved player.');
  assert.ok(requests.every(request => request.url.includes('/fleets/configured-fleet/')));
});

test('registers /winner-toggle without a target-player option or staff-only default restriction', () => {
  const data = winner.data.toJSON();
  assert.equal(data.name, 'winner-toggle');
  assert.equal(data.dm_permission, false);
  assert.equal(data.default_member_permissions, undefined);
  assert.deepEqual(data.options, []);
});
