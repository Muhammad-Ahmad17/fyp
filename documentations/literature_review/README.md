# IntelliSafe Literature Review — 30 Papers

All DOIs below were checked against OpenAlex on Nov 25, 2026. Papers not yet in a folder are listed with links in that folder's `LOCKED_PAPERS.md`.

## How to read (understanding notes)

| Who | PDFs | Plain-English notes |
|-----|------|---------------------|
| **Ahmad** | [`ahmad_platform_edge_iot/`](ahmad_platform_edge_iot/) | [`ahmad_notes/`](ahmad_notes/) — one `.md` per PDF |
| **Uzair** | [`uzair_cv_yolo_compliance/`](uzair_cv_yolo_compliance/) | [`uzair_notes/`](uzair_notes/) — one `.md` per PDF |

Each note has: explained simply, summary, key points, important quotes/numbers, why it matters for IntelliSafe, viva lines, and limits.

- `uzair_cv_yolo_compliance/` — detection, PPE, fire/smoke, IoU / NMS / thresholds, quantization, speed vs accuracy
- `ahmad_platform_edge_iot/` — Jetson / edge computing, MQTT, messaging (Redis Streams analogues), Docker, microservices, observability

## Uzair — CV / YOLO / Compliance Engine

| # | Paper | Topic | Status |
|---|-------|-------|--------|
| 01 | Redmon et al., "You Only Look Once," CVPR 2016 | YOLO foundation | PDF |
| 02 | Redmon & Farhadi, "YOLOv3: An Incremental Improvement," arXiv 2018 | YOLO evolution | PDF |
| 03 | Bochkovskiy et al., "YOLOv4," arXiv 2020 | YOLO evolution | PDF |
| 04 | Terven & Cordova-Esparza, "A Comprehensive Review of YOLO Architectures," MAKE 2023 | YOLOv1–v8 review | PDF |
| 05 | Huang et al., "Speed/Accuracy Trade-Offs for Modern Convolutional Object Detectors," CVPR 2017 | Latency vs accuracy vs size | PDF |
| 06 | Nath et al., "Deep learning for site safety," Automation in Construction 2020 | PPE detection | Manual |
| 07 | Wang et al., "Fast PPE Detection for Real Construction Sites," Sensors 2021 | PPE detection | Manual (free) |
| 08 | Fang et al., "Detecting non-hardhat-use ... far-field surveillance videos," Automation in Construction 2018 | Helmet detection | Manual (free) |
| 09 | Delhi et al., "Detection of PPE Compliance on Construction Site," Frontiers in Built Environment 2020 | PPE compliance | PDF |
| 10 | de Venâncio et al., "Automatic fire detection ... low-power devices," Neural Computing and Applications 2022 | Fire/smoke on edge | Manual |
| 11 | Muhammad et al., "Efficient Deep CNN-Based Fire Detection ... Video Surveillance," IEEE Trans. SMC 2018 | Fire detection | PDF |
| 12 | Zheng et al., "Distance-IoU Loss," AAAI 2020 | IoU / CIoU | PDF |
| 13 | Bodla et al., "Soft-NMS," ICCV 2017 | NMS / IoU threshold | PDF |
| 14 | Padilla et al., "A Survey on Performance Metrics for Object-Detection Algorithms," IWSSIP 2020 | mAP, IoU, confidence threshold | Manual |
| 15 | Jacob et al., "Quantization and Training of NNs for Integer-Arithmetic-Only Inference," CVPR 2018 | INT8 / FP16, TensorRT basis | PDF |

## Ahmad — Platform / Edge / IoT / Deployment

| # | Paper | Topic | Status |
|---|-------|-------|--------|
| 01 | Mittal, "A Survey on optimized implementation of DL models on the NVIDIA Jetson platform," JSA 2019 | Jetson, TensorRT | Manual |
| 02 | Shi et al., "Edge Computing: Vision and Challenges," IEEE IoT-J 2016 | Edge computing | Manual |
| 03 | Satyanarayanan, "The Emergence of Edge Computing," Computer 2017 | Edge computing | Manual |
| 04 | Zhou et al., "Edge Intelligence," Proc. IEEE 2019 | AI at the edge | PDF |
| 05 | Murshed et al., "Machine Learning at the Network Edge: A Survey," ACM CSUR 2021 | Edge ML deployment | PDF |
| 06 | OASIS, "MQTT Version 5.0," 2019 | MQTT standard | PDF |
| 07 | Light, "Mosquitto: server and client implementation of the MQTT protocol," JOSS 2017 | Mosquitto broker | PDF |
| 08 | Hunkeler et al., "MQTT-S," COMSWARE 2008 | MQTT origins | Manual |
| 09 | Yassein et al., "Internet of Things: Survey and open issues of MQTT protocol," ICEMIS 2017 | MQTT survey | Manual |
| 10 | Kreps et al., "Kafka: a Distributed Messaging System for Log Processing," NetDB 2011 | Log-based streams (Redis Streams analogue) | PDF |
| 11 | Dobbelaere & Esmaili, "Kafka versus RabbitMQ," DEBS 2017 | Pub/sub comparison | PDF |
| 12 | Merkel, "Docker: lightweight Linux containers," Linux Journal 2014 | Docker | Manual |
| 13 | Pahl et al., "Cloud Container Technologies: A State-of-the-Art Review," IEEE TCC 2019 | Containers | Manual |
| 14 | Dragoni et al., "Microservices: Yesterday, Today, and Tomorrow," 2017 | Microservices | PDF |
| 15 | Beyer et al., *Site Reliability Engineering*, O'Reilly 2016 | Monitoring / observability | Online book |
