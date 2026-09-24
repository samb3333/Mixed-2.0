# Winner role toggle

Run `/winner-toggle` to enable or disable the in-game Winner role for your saved username.
Save or update that name using `/edit_username` first. The command checks your current
Discord roles and requires either `1542454339661074452` or `1542454457197924402`.
Replies are private. The saved username is user-editable; this feature does not verify
ownership of the in-game account.

## Configuration

Set `ORION_API_KEY` in `.env` to an Orion Drift key with `role:read`,
`user_roles:write`, and `role:write` permissions for the fleet. This key is separate
from the existing `ODC` tournament key.

`WINNER_FLEET_ID` defaults to `1c74c4a2-b3b0-407d-b30a-f0ec6538a397`.
The Winner role ID is `c9305c3d-14e7-489a-a4f6-bf1f49b86fb9`.
Restart with `npm run dev` to build and register `/winner-toggle` in the configured Discord guild.

## Verification

Run `npm ci` and `npm test` to compile and run the mocked API and command tests.
In a development guild, verify that an eligible member can enable and disable Winner,
an ineligible member is denied, and unrelated in-game roles remain intact.
Do not automatically retry a failed toggle: a lost response may follow a successful change.
Overlapping toggles for the same username are blocked within one bot process.

The API routes and response handling follow Fleetview's
[endpoint registry](https://github.com/FairyVR/fleetview/blob/main/src/shared/registry/endpoints.ts)
and [role membership parser](https://github.com/FairyVR/fleetview/blob/main/src/renderer/src/lib/fleetUsers.ts).
