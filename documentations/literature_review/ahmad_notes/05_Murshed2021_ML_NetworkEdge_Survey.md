# Machine Learning at the Network Edge: A Survey

**Authors / venue / year:** M.G. Sarwar Murshed, Christopher Murphy, Daqing Hou, Nazar Khan, Ganesh Ananthanarayanan, Faraz Hussain / ACM Computing Surveys, vol. 54, no. 8 (the PDF is the arXiv version 1908.00080v4, May 2021) / 2021  
**PDF:** [05_Murshed2021_ML_NetworkEdge_Survey.pdf](../ahmad_platform_edge_iot/05_Murshed2021_ML_NetworkEdge_Survey.pdf)  
**Pages:** 35 · **Reading priority for IntelliSafe:** Medium  
**In one line:** A practical survey of how machine learning is deployed on resource-constrained edge devices, covering lighter models, quantization and pruning, distributed inference, real applications, software frameworks and hardware such as the Nvidia Jetson Nano.

## Explained simply

IoT devices such as sensors and cameras produce a lot of data but usually have little computing power. The usual fix is to send the data to cloud servers. Murshed et al. say this has three problems: it costs bandwidth, it slows the system's response, and it exposes private data. Their answer is **edge computing**: put extra computing devices close to where the data is produced. They use **edge-device** to mean either an **end-device** (a small device that produces data and can do light work) or an **edge-server** (a more capable machine near the devices). They give a direct example: an Nvidia Jetson Nano that takes images from a camera and processes them locally counts as an edge-device.

They list four benefits of the edge. Less data has to travel to a central location. Latency is lower because the computer is physically close. Personal information can be removed before anything is sent away. The system is more robust because it can keep working during a network failure or cyber attack. They also separate **edge** from **fog**. In edge computing, data is processed on the device with the sensor or on a gateway right next to it. In fog computing, data is processed a bit further away, on machines connected over the local area network (LAN).

Most of the survey explains how to make models fit on small hardware. One way is to design **lighter architectures**. For example, **depthwise separable convolutions** split one heavy convolution into two cheap steps, and MobileNets uses them to cut parameters from 29.3 million to 4.2 million with about 1% accuracy loss. The other way is **model compression**. **Quantization** stores weights with fewer bits (for example 8-bit integers or 16-bit fixed point instead of 32-bit floats), which shrinks memory and can speed up computation. **Pruning** removes weights or neurons that matter little. The two can be applied one after the other. **Knowledge distillation** trains a small model to copy a large one.

The survey also covers **distributed inference**, where one model is spread over several machines. It can be spread vertically (device, then edge server, then cloud, often with **early exit** points so easy inputs finish early) or horizontally across several devices at the same level. Finally it catalogues real applications (video analytics, speech, privacy, vehicles, smart homes, human safety), software frameworks (TensorFlow Lite, Core ML, TVM and others) and hardware (Google Coral Edge TPU, Intel Movidius, Raspberry Pi, Nvidia Jetson boards).

## Summary

Murshed et al. survey machine learning systems deployed at the edge of computer networks, from an operational point of view. They argue that sending raw IoT data to cloud servers increases communication cost, delays responses and endangers privacy, and that processing close to the data source addresses these issues. Unlike earlier surveys, they cover both classical ML (for example k-NN and tree-based models for microcontrollers) and deep learning. Section 2 reviews lighter architectures (MobileNets, ShuffleNet, EfficientNet, FastGRNN), distributed training and federated learning, model compression through quantization and pruning, and vertically and horizontally distributed inference. Section 3 describes applications including real-time video analytics, image recognition, speech recognition, privacy protection, autonomous vehicles, smart homes and cities, and human safety. Section 4 compares ML frameworks for edge devices and catalogues edge hardware such as ASICs, FPGAs, embedded GPUs including the Jetson family, and RISC-V chips. Section 5 discusses open challenges: building datasets, centralized versus distributed training, trust and explainability, and new topics such as compilers and blockchain. The survey includes 88 of 124 collected papers, all published before May 2020.

## Key points

- The authors state that transferring raw data to cloud servers increases communication costs, delays responses and makes private data vulnerable.
- Edge processing reduces data transfer, lowers latency, allows personal information to be removed before upload, and keeps services running during network failures.
- The survey names the Nvidia Jetson Nano as an example of an edge-device that processes camera data locally.
- Deploying deep learning on edge devices requires small models with few parameters and low computation, while keeping accuracy loss small.
- Quantization reduces the precision of stored parameters to lower the memory footprint, and pruning reduces the number of parameters; the two can be combined.
- One cited study used 8-bit quantization to reduce model size by 75% at the cost of about a 6% accuracy drop, which shows quantization is not free.
- Distributed inference can be vertical (end-edge-cloud with early exits) or horizontal (several devices sharing one model), and its success depends on keeping communication between devices low.
- The Jetson SDK (JetPack) includes TensorRT, cuDNN, CUDA and OpenCV, so the Jetson is presented as a full platform for edge AI and not just a board.
- No single framework or device wins everywhere; for example, one cited benchmark found the Coral Dev Board 3.5 times faster than the Jetson Nano (TF-TRT) on a MobileNetV2 SSD model.
- The authors warn that edge-deployed deep learning models are generally less accurate because of resource limits, which raises trust concerns in sensitive domains.

## Important highlights

> Transferring raw data to cloud servers increases communication costs, causes delayed system response, and makes any private data vulnerable to compromise.

(Section 1, page 1)

> an embedded device such as an Nvidia Jetson NANO could serve as an edge-device

(Section 1, page 2)

> Decentralization can make systems more robust by providing transient services during a network failure or cyber attack.

(Section 1, page 3)

> deep learning models deployed on edge-devices are inherently less accurate given the resource-constrained environment

(Section 5, "Trust and explainability", page 28)

**Numbers, definitions and figures worth remembering:**

- **Edge-device definition:** either an end-device or an edge-server (Section 1 and Fig. 1, page 2).
- **Edge versus fog:** edge processes data on or right next to the sensor's device; fog processes it further away on LAN-connected devices (Section 1, page 3).
- **Wind-farm cost study:** edge-cloud cost $28,927 against $80,531 for cloud-only, and 96% less data was transferred (Section 1, page 2).
- **MobileNets:** parameters reduced from 29.3 million to 4.2 million, computation cut by a factor of 8, about 1% accuracy loss (Section 2.1.1, page 6).
- **8-bit quantization:** 75% smaller model, about 6% accuracy drop (Ogden and Guo, Section 2.3.2, page 12).
- **SqueezeNet:** 50 times fewer parameters than AlexNet; with Deep Compression it fits in 0.47 MB, 510 times smaller than 32-bit AlexNet (Section 2.3.2, page 12).
- **Early exit (DDNN):** data communication cost reduced by a factor of more than 20 (Section 2.4.1, page 14).
- **Video analytics gap:** ML-based systems could process only about 3 FPS while cameras stream about 30 FPS (Section 3.1.1, page 15).
- **Jetson Nano spec (Table 5, page 24):** 128-core Maxwell GPU, quad-core ARM A57 CPU, 4 GB LPDDR4, 16 GB eMMC, 5-10 W.
- **Coral versus Jetson Nano:** Coral Dev Board 3.5 times faster than Jetson Nano (TF-TRT) on MobileNetV2 SSD (Section 4.2.1, page 25).

## Why it matters for IntelliSafe

- **It names our hardware class.** The survey uses the Jetson Nano processing camera data as its own example of an edge-device and describes JetPack with TensorRT. This supports choosing a Jetson Nano with YOLOv8n and a TensorRT FP16 engine as IntelliSafe's edge node.
- **It supports the "works without Internet" claim.** The paper says decentralization lets a system keep providing services during a network failure. In IntelliSafe, detection runs on the Jetson and events go to a Mosquitto broker on the site LAN, so alerts do not depend on an Internet link.
- **It supports the privacy and bandwidth argument.** IntelliSafe's edge agent sends only small JSON events over MQTT, never raw video. This is the same "process locally, send only what is needed" pattern the survey recommends.
- **It gives an honest view of quantization.** The 8-bit example (75% smaller, about 6% accuracy drop) is a reminder that IntelliSafe should measure mAP for helmet, vest, fire and smoke before and after the FP16 TensorRT conversion instead of assuming no loss.
- **It frames the architecture vocabulary.** In Murshed's terms, the Jetson running inference is the edge-device. If the backend (bridge, Redis, FastAPI, PostgreSQL) is moved from AWS EC2 onto a server on the site LAN, it would count as fog rather than cloud.

## How to use it in the report or viva

"Following Murshed et al., the Jetson Nano acts as our edge-device: it processes camera frames locally and sends only compact JSON events. This reduces communication cost and latency, keeps video private, and lets the system keep working during an Internet outage because the broker is on the site LAN [Murshed et al., 2021]."

"Quantization is not free; the survey reports cases with a few percent accuracy loss [Murshed et al., 2021], so we compare YOLOv8n accuracy before and after the TensorRT FP16 conversion."

## Limits and cautions

- The survey only covers papers published before May 2020. It does not cover YOLOv8, newer Jetson boards or the 2GB Jetson Nano; its Table 5 lists the 4 GB model, so IntelliSafe has half that memory.
- Most numbers are copied from cited studies on different models and hardware (for example MobileNet and SqueezeNet image classification, not object detection). They show trends, not what IntelliSafe will achieve.
- The wind-farm sentence says the edge-cloud system was "36% less expensive", but the dollar figures it gives mean the edge-cloud cost was about 36% of the cloud-only cost. Quote the dollar figures, not the percentage.
- The "Edge AI for Human Safety" section covers person re-identification, ride-sharing and city surveillance, with no PPE or workplace-safety detection examples. The current prototype also still runs the edge as a simulator on AWS EC2, so the edge benefits are argued, not yet measured.
