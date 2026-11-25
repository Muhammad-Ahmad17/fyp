# MQTT Version 5.0 (OASIS Standard)

**Authors / venue / year:** Andrew Banks, Ed Briggs, Ken Borgendale, Rahul Gupta (editors), OASIS MQTT Technical Committee / OASIS Standard, 07 March 2019 (supersedes MQTT 3.1.1, 2014) / 2019  
**PDF:** [06_OASIS2019_MQTT_v5.pdf](../ahmad_platform_edge_iot/06_OASIS2019_MQTT_v5.pdf)  
**Pages:** 137 · **Reading priority for IntelliSafe:** High (read selected sections only: 1.2, 2.4, 3.1.2.4-3.1.2.11, 3.3.1, 4.1-4.4, 4.7, 4.8)  
**In one line:** The official specification of MQTT 5.0, a lightweight publish/subscribe protocol for IoT that defines three delivery guarantees (QoS 0, 1, 2), retained messages, Will messages, sessions, topic wildcards and, new in v5, shared subscriptions, message expiry and reason codes.

## Explained simply

**MQTT** is a messaging protocol for devices. It uses **publish/subscribe**: a sender (**publisher**) does not send directly to a receiver. Instead it sends a message labelled with a **topic name** such as `ppe/alerts/CRITICAL` to a central **server**, usually called a **broker**. Any **client** that has **subscribed** to a matching **topic filter** gets a copy. Publishers and subscribers never need to know about each other. MQTT runs over TCP (port 1883, or 8883 with TLS encryption) and keeps its packets small, which is why it suits IoT.

**QoS (Quality of Service)** is the delivery guarantee for each message. **QoS 0, "at most once"**: the message is sent once with no acknowledgement, so it may be lost. **QoS 1, "at least once"**: the sender stores the message and keeps it until the receiver replies with a **PUBACK** (publish acknowledgement) carrying the same **packet identifier**. The message cannot be lost, but it can arrive twice. **QoS 2, "exactly once"**: a four-step handshake (PUBLISH, PUBREC, PUBREL, PUBCOMP) prevents both loss and duplicates, at the cost of more messages and more stored state. Example: if the broker's PUBACK for a fire alert is lost because Wi-Fi drops, a QoS 1 client that resumes its session re-sends the alert after reconnecting, and the subscriber may see it twice.

A **retained message** is a message the broker keeps as the "last known value" for a topic. When a new client subscribes, it immediately receives that stored message instead of waiting for the next publish. Publishing an empty (zero-byte) retained message deletes it. A **Will message** (often called **Last Will and Testament**) is a message the client gives the broker when it connects. The broker publishes it only if the client disappears without a clean disconnect, for example after a network failure. **Keep Alive** is how the broker notices a silent client. The client promises to send something (at least a PINGREQ) within the Keep Alive interval, and if the broker hears nothing for 1.5 times that interval it closes the connection as failed, which triggers the Will.

A **session** is the state the broker keeps for a client: its subscriptions and any QoS 1 or 2 messages not yet acknowledged. In v5, **Clean Start** decides whether to throw away the old session on connect, and **Session Expiry Interval** decides how long the session survives after a disconnect. Together they replace v3.1.1's single CleanSession flag. Topics are split into levels by `/`. In topic filters, `+` matches exactly one level and `#` matches any number of levels and must be last. So `ppe/#` matches `ppe/alarm` and `ppe/alerts/HIGH`, while `ppe/heartbeat/+` matches one heartbeat topic per device. Topics starting with `$` (such as the widely used `$SYS/` for broker statistics) are not matched by filters that start with a wildcard.

Version 5 adds features for larger systems. **Shared subscriptions** (`$share/{group}/{filter}`) deliver each message to only one member of a group, which spreads work across several consumers. **Message expiry** lets a publisher say "discard this if not delivered within N seconds". **Reason codes** on every acknowledgement say why something failed, for example 0x87 "Not authorized". **User properties** are custom key-value metadata on packets.

## Summary

The MQTT 5.0 standard, published by OASIS in March 2019, defines a client-server publish/subscribe messaging transport that is "light weight, open, simple" and aimed at constrained M2M and IoT environments where code size and bandwidth matter. It runs over any ordered, lossless, bidirectional transport such as TCP, TLS or WebSocket. The document specifies the data representation and the fifteen control packet types (CONNECT, PUBLISH, SUBSCRIBE and so on), including every field and property. Its operational chapter defines session state, three QoS levels with their packet flows, message retry on reconnect, ordering rules, topic names and filters with the `+` and `#` wildcards, `$`-prefixed topics, shared and non-shared subscriptions, flow control, request/response and error handling. Retained messages, Will messages and Keep Alive are defined in the CONNECT and PUBLISH packet sections. A non-normative security chapter covers authentication, authorization, TLS and related concerns. Appendix C lists what is new compared with 3.1.1: session expiry, message expiry, reason codes on all acknowledgements, shared subscriptions, user properties, topic aliases, flow control, Will delay, server Keep Alive and enhanced authentication.

## Key points

- QoS 0 gives at most once delivery with no acknowledgement, QoS 1 gives at least once delivery using PUBACK, and QoS 2 gives exactly once delivery using a two-step acknowledgement with extra overhead.
- With QoS 1 a receiver can get the same Application Message twice, even with the DUP flag set to 0 and a different packet identifier, so applications must tolerate duplicates.
- Unacknowledged QoS 1 and QoS 2 messages are re-sent only when a client reconnects with Clean Start set to 0 and an existing session; the standard forbids resending at any other time.
- When a PUBLISH has the RETAIN flag set, the broker replaces the stored message for that topic and delivers it to future subscribers; a zero-byte retained payload deletes it.
- The Will message is published if the network connection closes abnormally, including when the client misses its Keep Alive deadline, and it can itself be published as a retained message.
- If the broker receives nothing from a client within 1.5 times the Keep Alive period, it must close the connection as if the network had failed.
- The `#` wildcard matches any number of levels and must be the last character; `+` matches exactly one level; topic names are case-sensitive.
- Topic filters that start with a wildcard, such as `#` or `+/monitor/Clients`, never match topics beginning with `$`, which keeps broker-internal topics like `$SYS/` separate from application traffic.
- Shared subscriptions, message expiry, reason codes on all acknowledgements and user properties are new in v5 and do not exist in 3.1.1.
- Setting Clean Start to 1 with Session Expiry 0 in v5 is equivalent to CleanSession = 1 in v3.1.1.

## Important highlights

> It is light weight, open, simple, and designed to be easy to implement.

(Abstract, page 1)

> This Quality of Service level ensures that the message arrives at the receiver at least once.

(Section 4.3.2, QoS 1, page 94)

> Retained messages are useful where publishers send state messages on an irregular basis.

(Section 3.3.1.3, RETAIN, page 55)

> An Application Message which is published by the Server after the Network Connection is closed in cases where the Network Connection is not closed normally.

(Section 1.2, definition of Will Message, page 13)

> Non-shared Subscriptions cannot be used to load-balance Application Messages across multiple consuming Clients

(Section 4.8.1, page 101)

**Numbers, definitions and rules worth remembering:**

- **QoS table:** 0 = at most once, 1 = at least once, 2 = exactly once, 3 = reserved (Section 3.3.1.2, Table 3-2, page 54; flows in Section 4.3, pages 94-96).
- **Keep Alive:** 2-byte value in seconds; broker disconnects after 1.5 times the interval of silence; maximum 65,535 s (about 18 hours); 0 turns it off (Section 3.1.2.10, page 34).
- **Session Expiry Interval:** 0 or absent means the session ends when the connection closes; 0xFFFFFFFF means it never expires (Section 3.1.2.11.2, page 35).
- **Retry rule:** resend unacknowledged PUBLISH packets only on reconnect with Clean Start = 0 and session present (Section 4.4, page 96).
- **Reason codes:** one byte; below 0x80 means success, 0x80 or above means failure (Section 2.4, page 27).
- **Message Expiry Interval:** lifetime in seconds; if it passes before delivery starts, the broker deletes the message for that subscriber (Section 3.3.2.3.3, page 56).
- **Wildcards:** `#` multi-level (page 98), `+` single-level and `$` topics (page 99); topic names are case-sensitive (Section 4.7.3, page 100).
- **Shared subscription format:** `$share/{ShareName}/{filter}`; no retained messages are sent to shared subscribers on subscribe (Section 4.8.2, pages 101-102).
- **Ports:** 1883 for plain MQTT and 8883 for MQTT over TLS, registered with IANA (Section 4.2, page 93).

## Why it matters for IntelliSafe

- **Honest version note first.** IntelliSafe's Python code uses paho-mqtt with MQTT 3.1.1, not v5. Everything it relies on (QoS 1, retained messages, Last Will, Keep Alive, `+` and `#` wildcards) also exists in 3.1.1, and this v5 document is cited because it is the current standard and describes those features in the same way. The v5-only features (shared subscriptions, message expiry, reason codes, user properties) are not used yet.
- **QoS 1 plus UUID de-duplication.** The edge agent publishes alerts, metrics and heartbeats at QoS 1, so a fire or helmet alert is not silently lost when Wi-Fi drops. Section 4.3.2 says duplicates are possible, and IntelliSafe handles this by giving every event a UUID and de-duplicating on it in PostgreSQL. QoS 2 would add a four-packet handshake per message, and it only protects one network hop, while the later Redis Streams consumer group is also at-least-once. De-duplicating once in the database covers the whole pipeline.
- **Retained heartbeat and alarm topics.** `ppe/heartbeat/{device_id}` is retained, so a dashboard or bridge that starts later immediately sees each device's last heartbeat. `ppe/alarm` is retained so that the future ESP32 buzzer receives the current alarm state as soon as it subscribes, and the dashboard can silence it by publishing a new retained state. This is the "state message" use case in Section 3.3.1.3.
- **Last Will for device status.** A retained heartbeat stays on the broker even after the Jetson dies, so it can look falsely "alive". MQTT's answer is the Will message with Keep Alive: the broker notices silence after 1.5 times Keep Alive and publishes the Will. If used, the Will payload would also have to pass the bridge's Pydantic schema, because unknown fields are rejected.
- **Topic design and the bridge's `ppe/#` subscription.** `ppe/#` catches every IntelliSafe topic, including `ppe/alarm` itself, because `#` also matches the parent level. Broker statistics under `$SYS/` stay out of application traffic; even a bare `#` subscription would not receive them (Section 4.7.2). Topic names are case-sensitive, so the edge agent and bridge must agree exactly on the `{priority}` spelling in `ppe/alerts/{priority}`.
- **Where v5 could help later.** Shared subscriptions would let several bridge instances split the load; one bridge is enough for one room. Message expiry could drop stale metrics after an outage, and reason codes would make broker rejections easier to diagnose.

## How to use it in the report or viva

"We publish alerts with MQTT QoS 1 (at least once), so an alert is not lost if the network drops briefly. The standard says QoS 1 can deliver duplicates, so every event carries a UUID and the database de-duplicates on it, which gives effectively-once storage without the extra handshake of QoS 2 [OASIS 2019]."

"Heartbeat and alarm topics use retained messages, which the standard describes as suited to state that is published irregularly, so a late subscriber such as the dashboard or the buzzer immediately gets the latest state [OASIS 2019]. Our implementation uses MQTT 3.1.1 through paho-mqtt; these features are the same in 3.1.1, and v5-only features such as shared subscriptions are future work."

## Limits and cautions

- This is a specification, not an evaluation. It states what a compliant broker and client must do, but gives no latency, throughput or reliability measurements.
- IntelliSafe runs MQTT 3.1.1, so do not claim v5 features (shared subscriptions, message expiry, reason codes, user properties, Will delay) as part of the current system.
- QoS guarantees cover one hop (client to broker, or broker to client), not the end-to-end path through the bridge, Redis and FastAPI. Resending also depends on the session settings: a client that reconnects with a clean session does not get protocol-level resends of unacknowledged messages, so check the paho-mqtt session configuration.
- The security chapter is non-normative. TLS on port 8883 and authentication are available but not automatic, and a LAN broker without them can be read or published to by anyone on the network.
