# Microservices: yesterday, today, and tomorrow

**Authors / venue / year:** Nicola Dragoni, Saverio Giallorenzo, Alberto Lluch Lafuente, Manuel Mazzara, Fabrizio Montesi, Ruslan Mustafin, Larisa Safina / Book chapter in *Present and Ulterior Software Engineering* (Springer); this copy is arXiv:1606.04036v4 / 2017  
**PDF:** [14_Dragoni2017_Microservices.pdf](../ahmad_platform_edge_iot/14_Dragoni2017_Microservices.pdf)  
**Pages:** 17 · **Reading priority for IntelliSafe:** Medium  
**In one line:** A survey chapter that defines microservices as cohesive, independent processes that talk only through messages, traces how they grew out of objects and service-oriented computing, and lists their benefits along with real costs in performance, reliability, security and testing.

## Explained simply

A **monolith** is one program whose parts (modules) run together and share the same memory, files and database. The paper defines it strictly: an application whose modules cannot be executed independently. As monoliths grow, the authors list six problems: they become hard to understand, library updates break things ("dependency hell"), any change needs a full restart, one deployment setup must suit every module, scaling one busy part means copying the whole app, and you are locked into one language.

A **microservice** is a small, **cohesive** program (it does one closely related set of jobs) running as its own **independent process** and talking to others only by **messages**, such as HTTP requests or events through a broker. A **microservice architecture** is a distributed application in which every module is a microservice. Their example: a Calculator service, a Displayer service, and a Plotter service that calls both to draw a graph.

Historically, object-oriented design split code into objects inside one program; **service-oriented architecture (SOA)** then split systems into services reached by messages, but early SOA came with heavy, vague requirements. Microservices are presented as the second iteration of SOA, keeping each service simple. The term was coined at a workshop in 2011.

More terms. A **bounded context** groups related functions into one business capability, built as one service. **Orchestration** uses a central "conductor" service that directs the others; **choreography** has no conductor, and services react to events through publish/subscribe. **Containerisation** (for example Docker) packages each service with its own environment so it can be deployed alone.

The authors are balanced. Independent services are easier to test, maintain, deploy and scale individually. But every call now crosses a network, which is slower than an in-memory call, can fail, and gives attackers more entry points, and integration testing and monitoring get harder.

## Summary

The chapter is a survey for newcomers. It defines a monolith as an application whose modules cannot be executed independently, a microservice as a cohesive, independent process interacting via messages, and a microservice architecture as a distributed application made only of microservices. It lists six issues of monoliths (complexity, dependency hell, full restarts, one-size deployment, limited scaling, technology lock-in) and how microservices address each. It reviews the history from early software architecture and object-oriented patterns to service-oriented computing, presenting microservices as the second generation of SOA. The "Today" section covers distinctive traits (small size, bounded context, independence), team organisation following Conway's law, automation through continuous delivery and containers, and a preference for choreography over orchestration, then analyses availability, reliability, maintainability, performance, security and testability. The "Tomorrow" section discusses dependability (interfaces, behavioural types, choreographies) and trust and security challenges such as a larger attack surface and network complexity.

## Key points

- The paper gives formal definitions of a monolith, a microservice and a microservice architecture (Section 1).
- Six monolith problems (I|1 to I|6) are each paired with a microservice solution (S|1 to S|6).
- Microservices are framed as an evolution of service-oriented computing rather than a revolution.
- Their distinctive traits are small size, bounded context and operational independence, communicating only through published interfaces.
- Microservices are meant to be used with continuous integration and delivery and naturally suit containerisation.
- Choreography through events and publish/subscribe fits microservices' decentralised culture better than central orchestration.
- Network communication makes microservices slower and less reliable than in-memory calls; the cost depends on how interconnected services are.
- Each service can be tested alone, but integration testing is tricky because faults can emerge from interactions.
- Security suffers from a larger attack surface, complex network activity and services that fully trust each other.

## Important highlights

> A microservice is a cohesive, independent process interacting via messages.

(Definition 2, Section 1, page 2)

> A microservice architecture is a distributed application where all its modules are microservices.

(Definition 3, Section 1, page 2)

> The network latency is much greater than that of memory.

(Section 3.4, Performance, page 9)

> programming distributed systems is inherently harder than monoliths.

(Section 4, page 10)

**Definitions and facts worth remembering:**

- **Monolith (Definition 1, page 1):** a software application whose modules cannot be executed independently.
- **Origin of the term:** introduced in 2011 at an architectural workshop; Netflix used a similar style called fine-grained SOA (Section 3, page 6).
- **Three distinctive traits:** size, bounded context, independency (Section 3, page 6).
- **Orchestration versus choreography:** central conductor versus events and publish/subscribe (Section 3.3, pages 7 to 8).
- **Interface tools mentioned:** Jolie, Apache Thrift and Protocol Buffers for technology-independent message types (Section 4.1, page 11).

## Why it matters for IntelliSafe

- **Honest description of the built system.** The original plan proposed five FastAPI microservices. The built system is closer to a modular monolith plus separate infrastructure containers: one FastAPI service consumes the Redis Streams, writes PostgreSQL, publishes Redis pub/sub events, pushes WebSocket updates, generates PDF reports and drives the software alarm. By Definition 1 that service is a monolith, and the report should say so rather than call IntelliSafe a microservice architecture.
- **Some parts do match the definition.** The edge simulator, MQTT bridge and frontend are separate processes communicating only by messages (MQTT, Redis Streams, WebSocket). The bridge is cohesive (validate and forward) and independent, matching Definition 2. Every piece, including Mosquitto, Redis and PostgreSQL, runs in its own Docker Compose container, reflecting the paper's point that independent components suit containers.
- **The paper's own trade-offs justify merging the planned services.** It says microservices add network latency, integration-level failures, harder integration testing and a larger attack surface. For a small team and a single room, five services would bring those costs without the benefits of independent scaling or separate teams.
- **The event flow is choreography.** The edge publishes, the bridge reacts and appends to Redis Streams, and the API reacts through consumer group `alert-svc`; no central conductor calls each step.
- **Explicit message contracts.** The paper criticises informal interface documentation and points to formal message types. Pydantic validation in the bridge, with invalid payloads sent to `ppe:dead_letter`, is a practical version of this for JSON.

## How to use it in the report or viva

"Following Dragoni et al.'s definition of a monolith as an application whose modules cannot be executed independently, our FastAPI backend is a modular monolith, while the broker, bridge, database, Redis, simulator and frontend run as separate containers that communicate by messages [Dragoni et al., 2017]. We merged the five planned microservices into one service because the same survey notes that microservices add network latency, integration-testing difficulty and a larger attack surface, costs that outweigh the benefits at single-room scale [Dragoni et al., 2017]."

## Limits and cautions

- This is a survey and position chapter with no experiments, so it gives no measured evidence of when microservices beat monoliths.
- It does not use the term "modular monolith", so it supports IntelliSafe's choice only indirectly, through its discussion of microservice costs.
- It dates from 2016 to 2017 and much of its "Tomorrow" section concerns formal methods (behavioural types, choreographic programming) that are outside IntelliSafe's scope.
