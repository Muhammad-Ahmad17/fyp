# Kafka: a Distributed Messaging System for Log Processing

**Authors / venue / year:** Jay Kreps, Neha Narkhede, Jun Rao (LinkedIn) / NetDB '11 workshop, Athens, Greece / 2011  
**PDF:** [10_Kreps2011_Kafka.pdf](../ahmad_platform_edge_iot/10_Kreps2011_Kafka.pdf)  
**Pages:** 7 · **Reading priority for IntelliSafe:** High  
**In one line:** Kafka stores messages in an append-only, partitioned log that consumers pull from at their own pace, giving very high throughput and at-least-once delivery by keeping the broker simple.

## Explained simply

LinkedIn produces a huge stream of small events (clicks, page views, CPU readings) and wanted one system to deliver them both to real-time services within seconds and to offline analytics such as Hadoop. Kafka was built to do both.

The core idea is the **log**: an ordered list of records where new records are only added at the end (append-only). A **topic** is a named stream of one kind of message. A **producer** writes messages, a **broker** is a server that stores them, and a **consumer** reads them. Each topic is split into **partitions**; each partition is its own log, and partitions can sit on different brokers to spread the load.

Each message in a partition is identified by its **offset**, its position in the log. A consumer asks "give me data from offset 1000", processes it, then asks for the next offset. The consumer, not the broker, remembers how far it has read, so the broker is **stateless** about consumers and deletes old data by time (typically 7 days). A side effect is **rewind**: after fixing a bug, a consumer can re-read older offsets.

A **consumer group** is a set of consumers sharing a topic: each partition is read by exactly one member, so the group sees every message once, while a different group gets its own full copy. In 2011 Kafka used **ZooKeeper**, a coordination service, to track live brokers and consumers, partition ownership and each group's last consumed offset.

Kafka promises **at-least-once delivery**: messages are not skipped, but if a consumer crashes before saving its offset, its replacement may re-read some messages. For example, if a consumer processed offsets 501 to 510 but only saved 500, the new consumer reads 501 to 510 again. Applications that care must de-duplicate, and ordering is guaranteed only within one partition.

## Summary

The paper introduces Kafka, a distributed messaging system developed at LinkedIn for collecting and delivering high volumes of log data with low latency, for both online and offline consumers. The authors argue that enterprise messaging systems offer unneeded delivery features, lack batching, have weak distributed support and degrade when messages accumulate, while log aggregators such as Scribe and Flume target offline use and mostly push data. Kafka organises each topic into partitions stored as append-only segment files, addresses messages by logical offset, relies on the operating system page cache and the sendfile call for efficient transfer, and keeps the broker stateless by letting consumers track their own offsets, with time-based retention. Consumer groups coordinate through ZooKeeper and rebalance partitions without a central master. Delivery is at-least-once with per-partition ordering, and the 2011 version has no replication. The paper describes LinkedIn's deployment and shows Kafka achieving much higher producer and consumer throughput than ActiveMQ and RabbitMQ in a two-machine test.

## Key points

- Each partition of a topic is a logical log stored as segment files of roughly equal size (for example 1GB).
- Messages are addressed by offset rather than by a separate message ID, which avoids extra random-access index structures.
- Consumers pull data at their own rate, and because the broker does not track what they have read, messages are removed by a time-based retention policy.
- Within a consumer group, a partition is consumed by only one consumer at a time, so the partition is the unit of parallelism.
- Kafka guarantees at-least-once delivery and ordering within a partition, but not across partitions.
- Throughput comes from batching, using the file system page cache instead of an in-process cache, and sendfile to avoid extra copies.
- The 2011 design has no replication, so unconsumed messages on a permanently failed broker are lost; replication is future work.

## Important highlights

> In general, Kafka only guarantees at-least-once delivery.

(Section 3.3, page 4)

> Each partition of a topic corresponds to a logical log.

(Section 3.1, page 2)

> A message is automatically deleted if it has been retained in the broker longer than a certain period, typically 7 days.

(Section 3.1, "Stateless broker", page 3)

> the purpose of the experiment is not to show that other messaging systems are inferior to Kafka.

(Section 5, page 6)

**Numbers and design facts worth remembering:**

- **Producer throughput:** about 50,000 messages/s (batch size 1) and 400,000 messages/s (batch size 50), described as orders of magnitude higher than ActiveMQ and at least 2 times higher than RabbitMQ (Section 5, pages 5 to 6). The Kafka producer did not wait for acknowledgements in this test.
- **Consumer throughput:** about 22,000 messages/s, more than 4 times ActiveMQ and RabbitMQ (Section 5, page 6).
- **Storage overhead:** about 9 bytes per message in Kafka versus 144 bytes in ActiveMQ (Section 5, page 6).
- **LinkedIn production:** hundreds of gigabytes and close to a billion messages per day, about 10 seconds average end-to-end latency (Section 4, page 5).
- **Duplicates:** applications must de-duplicate using offsets or a unique key in the message (Section 3.3, page 4).

## Why it matters for IntelliSafe

- **Redis Streams uses the same log model.** The bridge XADDs each valid event to `ppe:alerts`, `ppe:metrics`, `ppe:heartbeat` or `ppe:dead_letter`. Each stream is an append-only log whose entry IDs play the role of Kafka offsets.
- **Consumer group `alert-svc` mirrors Kafka consumer groups.** FastAPI reads with XREADGROUP and confirms with XACK; unacknowledged entries stay pending and can be recovered after a crash, giving the at-least-once behaviour the paper describes. One difference: Redis keeps group progress on the server, while 2011 Kafka kept offsets in ZooKeeper.
- **UUID de-duplication follows the paper's advice.** Kafka says duplicates must be handled with a unique key in the message. IntelliSafe's event IDs are UUIDs and PostgreSQL dedupes on them, so redelivery from MQTT QoS 1 or Redis pending-entry recovery is safe.
- **Why Redis Streams is a reasonable small-scale analogue.** One room, one edge device and five YOLO classes is a tiny event rate next to LinkedIn's billion messages per day. Kafka's multi-broker partitions, disk retention and ZooKeeper coordination add operational cost the prototype does not need, while Redis is already in the stack for pub/sub. Each stream also behaves like a single partition, so events stay in order.
- **When IntelliSafe would actually need Kafka.** If the system grew to many sites or cameras whose combined rate or retention outgrows one Redis node's memory, if several analytics jobs needed to replay days of metrics, or if events had to be replicated across brokers for fault tolerance. Partitioning by `device_id` would then keep each device's events ordered.

## How to use it in the report or viva

"Our event pipeline follows the log-based messaging design introduced by Kafka: events are appended to a stream and read by a consumer group with at-least-once delivery [Kreps et al., 2011]. As Kafka's authors recommend, we handle duplicates in the application by de-duplicating on a unique event UUID [Kreps et al., 2011]. We used Redis Streams rather than Kafka because our single-room load is far below the volumes Kafka was designed for."

## Limits and cautions

- This is Kafka as of 2011; modern Kafka has replication, broker-side offset storage and no longer requires ZooKeeper, so do not describe today's Kafka from this paper alone.
- The benchmark uses one producer or consumer on two machines with no producer acknowledgements, and the authors say it shows the gain of a specialised system, not that others are worse.
- The paper says nothing about Redis Streams, MQTT or IoT, so the link to IntelliSafe is an analogy of design ideas, not evidence about Redis performance.
- Kafka targets log data where losing a few events is acceptable; IntelliSafe's CRITICAL fire and smoke alerts must not be lost, so it relies on acknowledgements and pending-entry recovery instead.
