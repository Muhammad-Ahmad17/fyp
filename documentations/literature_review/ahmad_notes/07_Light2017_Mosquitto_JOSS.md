# Mosquitto: Server and Client Implementation of the MQTT Protocol

**Authors / venue / year:** Roger A. Light / Journal of Open Source Software (JOSS), vol. 2, no. 13, article 265, doi:10.21105/joss.00265 / 2017  
**PDF:** [07_Light2017_Mosquitto_JOSS.pdf](../ahmad_platform_edge_iot/07_Light2017_Mosquitto_JOSS.pdf)  
**Pages:** 2 · **Reading priority for IntelliSafe:** Medium  
**In one line:** A short software paper that introduces Eclipse Mosquitto, an open-source, standards-compliant MQTT broker with command-line clients and a C client library, designed for lightweight messaging on constrained devices.

## Explained simply

MQTT, the messaging protocol used in IntelliSafe, is only a specification: a document that says how messages must be formatted and delivered. To use it you need software that implements it. The most important piece is the **broker** (the paper calls it the **server**). The broker accepts connections from clients, receives every published message and forwards it to every client whose subscription matches the message's topic. **Mosquitto** is one such implementation, and this paper is its official citation.

The **Journal of Open Source Software (JOSS)** publishes very short papers whose purpose is to make a piece of research software citable. The software itself, in its public repository, is what gets reviewed. So this paper does not contain experiments or benchmarks. It describes what Mosquitto is, who uses it, and why it is useful. That is why it is only two pages long, and most of the second page is references.

According to the paper, the Mosquitto project has three parts. The first is the **mosquitto server**, the broker program itself. The second is a pair of **command-line utilities**, `mosquitto_pub` and `mosquitto_sub`, which publish a message or subscribe to topics from a terminal. These are useful for testing and debugging without writing any code. For example, running `mosquitto_sub` on the filter `ppe/#` prints every IntelliSafe message as it passes through the broker. The third is a **client library** written in C with a C++ wrapper, which programs can use to talk MQTT.

The paper also explains why MQTT and Mosquitto suit the Internet of Things. MQTT uses **publish/subscribe** (senders and receivers only know topic names, not each other), has **low network overhead** (small packets), and can be implemented on low-power devices such as **microcontrollers**, the small chips used in remote sensors. Mosquitto is meant for any situation that needs lightweight messaging, especially on devices with limited resources. The project is part of the **Eclipse Foundation**, a non-profit organisation that hosts open-source projects, and the paper lists research and industry projects that use it.

## Summary

Light presents Mosquitto, an open-source project providing standards-compliant server and client implementations of the MQTT messaging protocol. The paper explains that MQTT uses a publish/subscribe model, has low network overhead and can be implemented on low-power devices such as microcontrollers in remote Internet of Things sensors, so Mosquitto targets any situation needing lightweight messaging, particularly on constrained devices. The project, a member of the Eclipse Foundation, has three parts: the mosquitto server (broker), the mosquitto_pub and mosquitto_sub command-line clients, and an MQTT client library written in C with a C++ wrapper. The paper describes Mosquitto as an enabler of research on MQTT itself, such as comparing MQTT with the Constrained Application Protocol (CoAP) and investigating OAuth for MQTT. It also served as a building block for larger systems, including MQTT evaluation for smart city services, an environmental monitoring system and remote control of a laboratory experiment. Outside academia it is used by the openHAB home automation project and the OwnTracks location tracking project, and has been integrated into commercial products. The paper reports no performance measurements.

## Key points

- Mosquitto provides both a server (broker) and client implementations of the MQTT protocol, and it is described as standards compliant.
- The project has three parts: the mosquitto server, the mosquitto_pub and mosquitto_sub command-line utilities, and a C client library with a C++ wrapper.
- The paper describes MQTT as having low network overhead and as implementable on low-power devices such as microcontrollers in remote IoT sensors.
- Mosquitto is intended for lightweight messaging in general, and especially for constrained devices with limited resources.
- The Mosquitto project is a member of the Eclipse Foundation, which gives it an open governance home rather than a single company owner.
- Researchers have used Mosquitto to study MQTT itself, for example comparing MQTT with CoAP and adding OAuth-based identity management to MQTT.
- Mosquitto has been used as a building block in smart city, environmental monitoring and remote laboratory systems.
- Outside academia, openHAB and OwnTracks use Mosquitto, and it has been integrated into commercial products.
- The paper is a software description, not an evaluation: it gives no latency, throughput or scalability results.

## Important highlights

> Mosquitto provides standards compliant server and client implementations of the MQTT messaging protocol.

(Summary, page 1)

> Mosquitto is intended for use in all situations where there is a need for lightweight messaging, particularly on constrained devices with limited resources.

(Summary, page 1)

> The Mosquitto project is a member of the Eclipse Foundation

(Summary, page 1)

**Facts worth remembering:**

- **Three components:** mosquitto server; mosquitto_pub and mosquitto_sub utilities; C client library with C++ wrapper (page 1).
- **Protocol model:** publish/subscribe, low network overhead, implementable on microcontrollers (page 1).
- **Research uses cited:** MQTT versus CoAP performance (Thangavel et al. 2014), OAuth in MQTT (Fremantle et al. 2014), smart city services (Antonić et al. 2015), environmental monitoring (Bellavista et al. 2017), remote laboratory control (Schulz et al. 2014) (page 1, references on pages 1-2).
- **Non-academic users:** openHAB home automation, OwnTracks location tracking, commercial products (page 1).
- **Citation:** Light, R. A. (2017). Journal of Open Source Software, 2(13), 265. doi:10.21105/joss.00265 (page footer).

## Why it matters for IntelliSafe

- **It is the citation for our broker.** IntelliSafe's edge agent publishes JSON events over MQTT QoS 1 to a Mosquitto broker, and the Python bridge subscribes to `ppe/#` on the same broker. When the report names Mosquitto, this is the paper to cite.
- **It supports the lightweight, LAN-based design.** The paper positions Mosquitto for lightweight messaging on constrained devices. This fits a site LAN where a Jetson Nano publishes small events and the proposal claims the system works without Internet because the broker is local.
- **It supports the future ESP32 buzzer.** The paper says MQTT can be implemented on microcontrollers. This supports the plan for an ESP32 buzzer to subscribe to the retained `ppe/alarm` topic and react to the alarm command, although the paper does not test any ESP32 device.
- **The command-line tools help testing and the viva demo.** `mosquitto_sub` can show live traffic on `ppe/#` to prove that alerts, metrics and heartbeats are flowing. `mosquitto_pub` can inject a test message to check that the bridge's Pydantic validation sends a malformed payload to `ppe:dead_letter`.
- **Open source with foundation backing.** Being an Eclipse Foundation project used in research and commercial products is a reasonable argument that Mosquitto is a mature, low-risk choice for a final-year project, not an experimental component.

## How to use it in the report or viva

"We use Eclipse Mosquitto as the MQTT broker. It is an open-source, standards-compliant MQTT server designed for lightweight messaging on constrained devices, and it is widely used in research and industry [Light 2017]. Running it on the site LAN means edge devices and the backend can exchange events without an Internet connection."

"During testing we used Mosquitto's own `mosquitto_sub` and `mosquitto_pub` clients to watch and inject messages on the `ppe/#` topics [Light 2017]."

## Limits and cautions

- This is a two-page software description from 2017. It contains no benchmarks, so it cannot support any claim about Mosquitto's latency, throughput or how many clients it can handle.
- The paper does not say which MQTT versions Mosquitto supports, nor does it describe features such as persistence, authentication, access control or TLS. Use the current Mosquitto documentation for those, and the OASIS standard for protocol behaviour.
- The "constrained devices" claim is about MQTT clients such as sensors and microcontrollers. The broker itself runs on a normal computer or server, and the paper gives no guidance on sizing it.
- The paper does not compare Mosquitto with other brokers (for example EMQX or HiveMQ), so it does not by itself justify choosing Mosquitto over them; the justification is simplicity and fitness for a single-room deployment.
