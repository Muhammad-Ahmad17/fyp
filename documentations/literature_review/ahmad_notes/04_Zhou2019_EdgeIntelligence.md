# Edge Intelligence: Paving the Last Mile of AI with Edge Computing

**Authors / venue / year:** Zhi Zhou, Xu Chen, En Li, Liekang Zeng, Ke Luo (Sun Yat-sen University), Junshan Zhang (Arizona State University) / Proceedings of the IEEE, vol. 107, no. 8 (the PDF is the arXiv preprint 1905.10083v1) / 2019  
**PDF:** [04_Zhou2019_EdgeIntelligence.pdf](../ahmad_platform_edge_iot/04_Zhou2019_EdgeIntelligence.pdf)  
**Pages:** 24 · **Reading priority for IntelliSafe:** High  
**In one line:** A survey arguing that deep learning should run close to where data is produced, which rates "edge intelligence" on six levels and reviews the techniques (compression, quantization, partitioning, early exit, input filtering) that make DNN inference practical on edge hardware.

## Explained simply

Most AI services today send data to the **cloud**, meaning large remote datacenters. Zhou et al. point out that most new data is now produced at the **network edge**: phones, cameras and IoT sensors at the "last mile" of the Internet. Shipping all of it across the **wide-area network (WAN)**, the long-distance Internet link between a site and a datacenter, costs money, adds delay and exposes private data. **Edge computing** moves computation to an **edge node** near the data source. The paper says an edge node can be anything from a credit-card-sized computer to a small rack of servers, and that physical closeness to the data is what matters most.

**Edge intelligence** (edge AI) means running AI, mainly **deep neural networks (DNNs)**, at the edge. A DNN has two phases. **Training** adjusts the model's weights using lots of labelled data and is very expensive. **Inference** runs the trained model forward on a new input (for example one camera frame) to get a prediction, and it is much cheaper. The authors argue that edge intelligence should not only mean "everything on the device". It can also mean device, edge server and cloud working together. To make this concrete they define six levels. At Level 1 the cloud trains and the edge and cloud share inference. At Level 3 the cloud trains and inference runs fully on the device, with no data offloaded. At Level 6 both training and inference run on the device. Higher levels send less data, so transmission delay, WAN cost and privacy risk go down. The price is more computation and energy on the device. There is no single best level, and the right choice depends on the application.

For inference, the paper describes four modes. In **edge-based** mode the device sends its input to an edge server. In **device-based** mode the device runs the whole model itself. **Edge-device** and **edge-cloud** modes split the model between two places. Device-based inference is reliable because it does not depend on the network, but it needs a lot of CPU, GPU and RAM on the device. The paper judges inference on six indicators: latency, accuracy, energy, privacy, communication overhead and memory footprint.

It then lists techniques that make inference fit on small hardware. **Model compression** shrinks the model. **Weight pruning** deletes weights that contribute little. **Quantization** stores numbers in fewer bits than the usual 32-bit floating point, for example 16-bit or 8-bit. Fewer bits mean less memory and faster arithmetic, usually with a small loss of accuracy. **Model partition** runs the first layers on the device and the rest on a server; Neurosurgeon is the best-known system that picks the best split point. **Early exit** adds extra output branches so that easy inputs finish before the last layer. **Input filtering** skips video frames that have barely changed. **Application-specific optimisation** tunes knobs such as frame rate and resolution, trading some accuracy for lower resource use.

## Summary

Zhou et al. survey edge intelligence, the combination of edge computing and AI. Their motivation is that most data is now generated at the network edge by mobile and IoT devices, and moving it to cloud datacenters costs WAN bandwidth, adds delay and risks privacy. After a primer on deep learning models, they argue that edge intelligence should cover any cooperation across device, edge and cloud, not only on-device execution. They propose a six-level rating, from cloud intelligence up to fully on-device training and inference, in which higher levels reduce data offloading at the cost of more on-device computation and energy. The first half reviews distributed training at the edge: federated learning, aggregation frequency control, gradient compression, DNN splitting, knowledge transfer and gossip training. The second half covers inference: four edge-centric inference modes, performance indicators (latency, accuracy, energy, privacy, communication overhead, memory footprint), and enabling techniques including model compression, model partition, early exit, edge caching, input filtering, model selection, multi-tenancy support and application-specific tuning. Tables summarise existing systems and their reported gains. The paper closes with open directions such as programming platforms, resource-aware model design, 5G networking and security.

## Key points

- The authors argue that pushing AI to the edge is motivated by performance, cost and privacy, because moving large data over the WAN is slow, expensive and risky.
- Edge computing promises low latency, energy efficiency, privacy protection, reduced bandwidth consumption, on-premises operation and context-awareness compared with cloud-only processing.
- The six-level rating shows a trade-off: higher levels mean less data offloading, lower transmission latency, more privacy and lower WAN cost, but more on-device computation and energy.
- Real-time video analytics is presented as a "killer application" for edge computing because it needs high computation, high bandwidth, high privacy and low latency at the same time.
- In device-based inference the device does not talk to the edge server during inference, so it is reliable, but its performance depends entirely on the local CPU, GPU and RAM.
- Latency must be measured end to end, including pre-processing, inference, data transmission and post-processing, not just the time inside the model.
- Accuracy can drop in video analytics when frames arrive faster than the device can process them and some frames are skipped.
- Model compression (pruning, quantization, compact architectures) is the main way to make on-device inference feasible, and it reduces latency, energy, memory footprint and privacy risk.
- Fewer weights do not automatically mean less energy, because convolution layers dominate energy use while fully-connected layers hold most of the weights.
- The authors state that standard metrics such as top-k accuracy or mean average precision do not reflect runtime performance on edge devices, so speed and resource use must also be measured.

## Important highlights

> real-time video analytics is envisioned to be a killer application for edge computing

(Section III-A, page 5)

> there is no “best-level” in general; instead, the “best-level” edge intelligence is application-dependent

(Section III-B, page 6)

> Latency refers to the time spent in the whole inference process, including pre-processing, model inference, data transmission, and post-processing.

(Section V-B, page 13)

> Since representing a number with fewer bits reduces memory footprint and accelerates computation, data quantization improves overall computation and energy efficiency.

(Section V-C, Model Compression, page 14)

**Numbers, definitions and figures worth remembering:**

- **Six-level edge intelligence rating:** Fig. 7 and the level definitions (Section III-B, page 6). Level 3 = "On-Device Inference and Cloud Training", where no data is offloaded.
- **Four inference modes:** edge-based, device-based, edge-device, edge-cloud (Fig. 12, Section V-A, page 12).
- **Data growth:** Cisco estimate of nearly 850 ZB generated at the edge by 2021, against 20.6 ZB of global datacenter traffic (Section I, page 1).
- **Example deadline:** real-time applications such as AR/VR gaming may need around 100 ms latency (Section V-B, page 13).
- **Pruning results:** magnitude-based pruning cut AlexNet weights by 9x and VGG-16 by 13x with no ImageNet accuracy loss; Deep Compression reached 35-49x (Section V-C, page 13).
- **Model size reference:** AlexNet needs 61 million weights and 724 million multiply-add operations for one 227x227 image (Section II-D, page 3).
- **Model partition example:** Neurosurgeon reports 3.1-40.7x latency reduction and 59.5%-94.7% energy reduction (Table IV, page 19). These figures come from the cited paper's own setup.
- **Input filtering:** NoScope skips frames with little change, using a cheap difference detector (Section V-C, page 16).

## Why it matters for IntelliSafe

- **It justifies running YOLOv8n on the Jetson Nano.** IntelliSafe matches the device-based inference mode and is closest to Level 3: the model is trained elsewhere, inference runs fully on the edge device, and only small JSON events (alerts, metrics, heartbeats) leave the device, never raw video. This is the paper's argument for latency, privacy and bandwidth, which are the same three reasons given in the IntelliSafe proposal.
- **It supports the offline claim.** Device-based inference does not depend on the network during inference. Together with the Mosquitto broker on the site LAN, this lets PPE and fire or smoke detection continue without an Internet connection.
- **It explains the TensorRT FP16 plan.** The paper's description of data quantization (fewer bits than 32-bit floating point, giving less memory and faster computation) is the theory behind converting YOLOv8n to FP16 for the 2GB Jetson Nano, where memory footprint is a real constraint.
- **It tells us how to measure latency.** Zhou defines latency as the whole pipeline, so IntelliSafe should report detection-to-dashboard time (capture, YOLO, compliance engine, MQTT, bridge, Redis Streams, FastAPI, WebSocket), not only the model's frames per second.
- **It warns about frame skipping.** At 640x640 on a Jetson Nano, frames may arrive faster than they can be processed. The paper notes that skipped frames reduce accuracy in video analytics, which matters for short events such as a worker briefly removing a helmet.
- **It lists future options without overclaiming.** Input filtering and frame-rate or resolution tuning are techniques the team could evaluate later; they are not part of the current design.

## How to use it in the report or viva

"We run YOLOv8n directly on the Jetson Nano and publish only small JSON events. In Zhou et al.'s terms this is device-based inference at Level 3 (cloud or workstation training, fully on-device inference), which reduces transmission latency, protects privacy because video never leaves the site, and saves WAN bandwidth [Zhou et al., 2019]."

"We plan TensorRT FP16 because quantization to fewer bits reduces memory footprint and speeds up computation, which matters on a 2GB board [Zhou et al., 2019]. We measure latency end to end, from frame capture to the dashboard, following the paper's definition."

## Limits and cautions

- The survey is from 2019. It predates YOLOv8 and does not mention the Jetson Nano, TensorRT or FP16 specifically, so it supports the general approach but not IntelliSafe's exact hardware and software choices.
- The speed-up numbers in Tables II and IV come from different cited papers with different models, hardware and datasets. They cannot be compared with each other or used to predict IntelliSafe's performance.
- About half the paper is on distributed training (federated learning, gossip training), which IntelliSafe does not do. Much of the inference half assumes phones and base stations, not a fixed camera on a LAN.
- The current prototype runs the edge as a simulator on AWS EC2, so it does not yet demonstrate the latency, privacy or offline benefits; those claims only hold once the Jetson and site LAN broker are deployed.
