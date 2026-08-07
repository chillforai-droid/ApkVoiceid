# VoiceID Call Handshake Recovery Fix

## Failure proven by the device diagnostics
Caller subscribed successfully, receiver subscribed successfully and `receiver-ready` returned `ok`, but the caller never logged `RECEIVER_READY_RECEIVED`. Therefore no SDP offer was created and ICE/TURN was never reached.

## Fix
`receiver-ready` remains supported for Web compatibility, but it is no longer the only way to start the offer.

The receiver already writes `calls.status = accepted` only after its signalling channel is SUBSCRIBED. The caller now treats this persistent state as a recovery trigger:

1. Normal path: `receiver-ready` -> start offer.
2. Realtime recovery: caller sees `calls.status=accepted` -> start offer.
3. Durable fallback: after caller channel subscribes, it checks the call row every 500ms for up to 10 seconds. If status is `accepted`, it starts the offer.
4. `offerStarted` still guarantees only one offer is generated even if multiple triggers arrive.

No backend schema/API changes were made. TURN configuration is unchanged.

## Diagnostic expectation after this build
Caller should show one of `RECEIVER_READY_RECEIVED`, `ACCEPTED_RECOVERY_TRIGGER`, or `ACCEPTED_FALLBACK_TRIGGER`, followed by `PEER_CREATING`, `OFFER_CREATED`, and `OFFER_SENT`.
