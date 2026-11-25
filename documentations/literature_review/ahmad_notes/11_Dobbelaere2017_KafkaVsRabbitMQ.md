# Kafka versus RabbitMQ

**Authors / venue / year:** Philippe Dobbelaere, Kyumars Sheykh Esmaili (Nokia Bell Labs) / arXiv:1709.00333, extended version of their ACM DEBS 2017 paper / 2017  
**PDF:** [11_Dobbelaere2017_KafkaVsRabbitMQ.pdf](../ahmad_platform_edge_iot/11_Dobbelaere2017_KafkaVsRabbitMQ.pdf)  
**Pages:** 25 · **Reading priority for IntelliSafe:** High  
**In one line:** Kafka (a partitioned, replayable disk log built for very high throughput) and RabbitMQ (an AMQP broker with flexible routing and in-memory queues built for low, predictable latency) suit different problems, and the choice should follow the application's requirements rather than headline benchmarks.

## Explained simply

Both systems are **publish/subscribe (pub/sub)** middleware: producers hand messages to a server called a **broker**, and consumers receive them from it, so the two sides never need to know each other or be online at the same time. The paper asks which one to use, and answers with a shared vocabulary, a feature comparison, measurements and a decision table.

Key vocabulary. **At most once**: a message may be lost on failure but is never duplicated. **At least once**: never lost, but recovery may create duplicates. **Exactly once**: neither, which needs an expensive two-phase commit. **Topic-based routing** sends messages by a label (for example `ppe/alerts/critical`); **content-based routing** filters on fields inside the message. **Latency** is the time for one message to pass through; **throughput** is messages per second.

**Kafka** stores each topic as **partitions**, ordered append-only logs on disk. Consumers pull by position (offset) and track it themselves, so Kafka does not know who has read what and deletes data after a retention time. This makes **replay** easy.

**RabbitMQ** implements **AMQP**, a standard messaging protocol. A producer sends a message with a **routing key** to an **exchange** (a router), which uses **bindings** (rules) to place it in one or more **queues**. A queue holds messages until consumers acknowledge them, then deletes them. RabbitMQ keeps messages in memory where possible and is optimised for nearly empty queues.

A simple picture: Kafka is a notebook anyone can re-read from any page; RabbitMQ is a post office that sorts letters into the right mailbox and discards them once collected.

## Summary

The paper frames Apache Kafka and RabbitMQ within a common pub/sub framework covering decoupling, routing, delivery and ordering guarantees, reliability, availability, transactions, scalability and efficiency. Qualitatively, RabbitMQ offers rich AMQP routing, per-message acknowledgements, ordering on a channel and multi-protocol support including MQTT, but degrades when messages accumulate beyond memory. Kafka offers partitioned disk-based logs with long-term storage, replay, log compaction and scaling through partitions, but only basic topic routing and ordering only within a partition. Quantitatively, on a single 24-core server with Kafka 0.10.0.1 and RabbitMQ 3.5.3, both reach millisecond-level latency, though Kafka's latency grows sharply when reads miss the page cache. RabbitMQ outperforms Kafka in the most basic single-node setup, while adding partitions significantly raises Kafka's throughput. At-least-once delivery and replication reduce throughput for both. The paper closes with preferred use cases, ways to combine the two systems, and a determination table.

## Key points

- RabbitMQ is close to classic messaging: it does the consumption bookkeeping, keeps messages in memory and works best with nearly empty queues.
- Kafka is built around a distributed commit log, keeps no per-consumer state, and deletes messages only by an age- or size-based retention policy.
- RabbitMQ has far richer routing (topic exchanges with `*` and `#` wildcards, header exchanges, custom exchanges); Kafka offers basic topic routing plus choice of partition.
- Kafka preserves order only within a partition; RabbitMQ preserves order on a single AMQP channel.
- Both give low-millisecond latency normally, but Kafka's latency can grow by about an order of magnitude when it reads from disk.
- In at-least-once mode, RabbitMQ throughput drops by about 50 percent and Kafka's by about 50 to 75 percent compared with best effort.
- Kafka is recommended for very high throughput per topic, ingestion, change feeds and stream processing; RabbitMQ for flexible routing, request-response and as an IoT platform layer.

## Important highlights

> Compared to Kafka, RabbitMQ is much closer to the classic messaging systems.

(Section 3.2.2, page 9)

> Kafka will conserve order only inside a partition.

(Section 4.4, page 11)

> This table obviously oversimplifies the decision to take

(Determination Table, Section 7, page 23)

**Numbers and facts worth remembering:**

- **Test setup:** one server, 24 cores, 12GB DRAM, one 7200 rpm disk; default settings, which for Kafka favour latency over throughput (Section 5, page 13).
- **Latency from memory (Table 2, page 14):** RabbitMQ mean 1 to 4 ms, max 2 to 17 ms; Kafka median 1 ms, 99.9th percentile 15 ms without replication and 30 ms with.
- **Kafka disk-read penalty:** latency up to around 100 ms when data comes from disk (Section 5.1, page 16).
- **Cost of at-least-once:** RabbitMQ throughput minus 50 percent (page 18); Kafka minus 50 to 75 percent (page 19).
- **Partitions:** Kafka throughput peaked at about 200 partitions in their setup, so partition count is a key tuning choice (Section 5.2.1, page 17).
- **RabbitMQ for IoT:** sub 5 ms latency for most packets, up to 40Kpps on a single node, and MQTT support (Section 7.2.4, page 22).

## Why it matters for IntelliSafe

- **It explains the trade-off behind Redis Streams.** IntelliSafe wanted Kafka's idea (a replayable append-only log with consumer groups) without running a Kafka cluster. Redis Streams gives XADD, XREADGROUP, XACK and pending-entry recovery in one container that is already used for pub/sub, so it is a reasonable small-scale analogue of the Kafka column of this paper.
- **IntelliSafe is far below the point where Kafka wins.** The paper recommends Kafka when throughput per topic exceeds what RabbitMQ can handle, an event firehose. One room and one edge device publishing alerts, metrics and heartbeats is nowhere near that.
- **When IntelliSafe would need Kafka.** The paper's Kafka use cases suggest the triggers: many sites streaming at high combined rates, keeping and replaying days of history for analytics or retraining, or several independent consumers each reading the full stream. Kafka partitioned by `device_id` would then be the natural upgrade.
- **RabbitMQ was a credible alternative.** Its MQTT support, wildcard topic routing, message TTL and low latency fit IoT, as the paper says. IntelliSafe chose Mosquitto plus a Python bridge so that Pydantic validation and the `ppe:dead_letter` stream live in team-controlled code; the report should present this as a preference, not as RabbitMQ being unsuitable.
- **Guarantees map directly.** MQTT QoS 1 and Redis consumer groups are both at-least-once (no loss, possible duplicates); IntelliSafe absorbs duplicates by de-duplicating on event UUIDs in PostgreSQL. Each Redis stream is one ordered log, avoiding Kafka's cross-partition ordering limit.

## How to use it in the report or viva

"Dobbelaere and Esmaili show that Kafka suits very high throughput, long retention and replay, while RabbitMQ suits flexible routing and predictable low latency, and that at-least-once delivery costs throughput in both [Dobbelaere and Esmaili, 2017]. Our single-room workload is far below the scale where Kafka pays off, so we used Redis Streams, which offers Kafka-style logs and consumer groups inside infrastructure we already run [Dobbelaere and Esmaili, 2017]."

## Limits and cautions

- The paper does not evaluate Redis Streams or Mosquitto, so it is not evidence that Redis Streams is fast enough; that must come from IntelliSafe's own tests.
- Results are for Kafka 0.10 and RabbitMQ 3.5 on one machine in 2017; both systems have changed considerably, so treat the numbers as dated.
- The authors warn that the determination table oversimplifies the decision and that their study is not exhaustive; their Kafka throughput model also had a 30 to 45 percent mean error (Table 4).
