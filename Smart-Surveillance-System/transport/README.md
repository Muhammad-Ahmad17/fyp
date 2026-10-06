# Transport layer (Member A)

- [`mqtt_redis_bridge/`](mqtt_redis_bridge/) — subscribe `ppe/#`, XADD to Redis streams
- [`event_simulator/`](event_simulator/) — Jetson stand-in; publishes all 6 contract events

Run via `infra/docker-compose.yml` (see [`infra/README.md`](../infra/README.md)).
