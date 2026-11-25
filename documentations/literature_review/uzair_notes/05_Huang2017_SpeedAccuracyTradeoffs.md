# Speed/Accuracy Trade-offs for Modern Convolutional Object Detectors

**Authors / venue / year:** Jonathan Huang, Vivek Rathod, Chen Sun, Menglong Zhu, Anoop Korattikara, Alireza Fathi, Ian Fischer, Zbigniew Wojna, Yang Song, Sergio Guadarrama, Kevin Murphy (Google Research) / CVPR / 2017 (arXiv:1611.10012v3)  
**PDF:** [05_Huang2017_SpeedAccuracyTradeoffs.pdf](../uzair_cv_yolo_compliance/05_Huang2017_SpeedAccuracyTradeoffs.pdf)  
**Pages:** 21 · **Reading priority for IntelliSafe:** Medium  
**In one line:** By re-implementing SSD, Faster R-CNN and R-FCN in one framework and sweeping backbones, input sizes and other settings, this paper shows in a fair way how detector choices trade accuracy against speed and memory, and identifies small objects and input resolution as the main pressure points.

## Explained simply

Papers usually report accuracy on one setup and speed on another, which makes comparisons unfair. This Google team rebuilt three detector families, which they call **meta-architectures**, in a single TensorFlow codebase. They then swapped parts in and out and timed everything on the same machine (a Titan X GPU) at batch size 1. In total they report 147 model configurations.

The three families are:
- **SSD (single-shot detector):** one network directly predicts classes and box offsets for every **anchor** (a pre-set box shape at a fixed position) in a single pass. The authors explicitly group YOLO under this "SSD" family.
- **Faster R-CNN:** a two-stage detector. First a region proposal network suggests candidate boxes (typically 300), then a second stage classifies and refines each one.
- **R-FCN:** a two-stage design that moves most of the per-box work into shared layers, so it is faster than Faster R-CNN.

Each family can be combined with a different **feature extractor** (backbone), from the light **MobileNet** (3.2 million parameters) to the heavy Inception ResNet V2 (54 million). Other "knobs" include **input resolution** (shorter side 300 or 600 pixels), **output stride** (how much the backbone shrinks the image), and the **number of proposals** for the two-stage models.

Results are plotted as mAP against GPU time, and the best models form an **optimality frontier**: points where you cannot gain accuracy without losing speed. At the fast end sit SSD with MobileNet or Inception V2 at low resolution. In the middle is a "sweet spot" of R-FCN or Faster R-CNN with ResNet-101 and few proposals. At the accurate end is Faster R-CNN with Inception ResNet V2, which needs close to one second per image.

Two findings matter most for small objects. Halving the input resolution in both dimensions lowered accuracy by 15.88% on average but cut inference time by 27.4%, because high resolution "allows for small objects to be resolved". And SSD-style detectors did very poorly on small objects but stayed competitive on large ones. For example, a helmet 24 pixels wide in a 640x640 frame becomes only 12 pixels wide if the frame is shrunk to 320x320, and that is exactly the kind of object these single-shot models lose first.

## Summary

The paper aims to guide practitioners in choosing a detector that balances speed, memory and accuracy for their platform. The authors implement the Faster R-CNN, R-FCN and SSD meta-architectures in a unified TensorFlow system and combine them with six feature extractors (VGG-16, ResNet-101, Inception V2, Inception V3, Inception ResNet V2 and MobileNet). They vary input resolution, output stride and number of proposals, training on COCO and timing on a Titan X GPU at batch size 1. Results trace an accuracy-versus-time frontier. SSD with MobileNet or Inception V2 at low resolution is fastest, R-FCN or Faster R-CNN with ResNet-101 and few proposals is the sweet spot, and Faster R-CNN with Inception ResNet V2 is most accurate. Key findings: SSD is less sensitive to backbone quality but weak on small objects; higher resolution greatly helps small objects; using 50 instead of 300 proposals keeps 96% of accuracy at about one third of the time; and mAP@.5 and mAP@.75 correlate almost perfectly with COCO mAP. An ensemble of five Faster R-CNN models won the 2016 COCO challenge with 41.3% mAP.

## Key points

- Fair comparison needs the same framework, hardware, batch size and timing method. Reported FPS from different papers are often not comparable.
- The authors treat YOLO as an SSD-style (single-shot) meta-architecture whose matching rule is based on box centres.
- SSD models with MobileNet or Inception V2 at low resolution are the fastest frontier models but the least accurate (18.8% and 21.6% test-dev mAP).
- Detection accuracy correlates with backbone ImageNet accuracy for Faster R-CNN and R-FCN, but SSD depends less on its feature extractor.
- All methods do much better on large objects. SSD is very poor on small objects but competitive on large ones.
- Halving input resolution in both dimensions lowers accuracy by 15.88% on average and reduces inference time by 27.4% on average.
- Post-processing, including NMS on the CPU, takes about 40 ms and caps the fastest models at 25 FPS, so it must be counted in real latency.
- MobileNet is the cheapest in memory, needing less than 1 GB in almost all settings, and memory use rises with running time.
- mAP@.75 is almost perfectly correlated with COCO mAP@[.5:.95] (R² > .99), so a detector that is weak at strict IoU is also weak overall.

## Important highlights

> "Postprocessing can take up the bulk of the running time for the fastest models at ∼ 40ms and currently caps our maximum framerate to 25 frames per second." (Section 3.5, page 6)

> "SSD models typically have (very) poor performance on small objects, they are competitive with Faster RCNN and R-FCN on large objects" (Section 4.1.4, page 10)

> "consistently lowers accuracy (by 15.88% on average) but also reduces inference time by a relative factor of 27.4% on average." (Section 4.1.5, page 10)

> "high resolution inputs allow for small objects to be resolved." (Section 4.1.5, page 10)

**Numbers worth remembering**

- **Frontier models (minival / test-dev mAP): SSD MobileNet low-res 19.3 / 18.8; SSD Inception V2 low-res 22 / 21.6; Faster R-CNN ResNet-101 with 100 proposals 32 / 31.9; R-FCN ResNet-101 with 300 proposals 30.4 / 30.3; Faster R-CNN Inception ResNet V2 with 300 proposals 35.7 / 35.6** (Table 3)
- **Backbone sizes: MobileNet 3,191,072 parameters, 71.1% top-1; VGG-16 14.7 M; ResNet-101 42.6 M; Inception ResNet V2 54.3 M, 80.4% top-1** (Table 2)
- **Halving resolution: -15.88% accuracy, -27.4% time on average** (Section 4.1.5)
- **Stride 8 instead of 16: about 5% better mAP (relative), 63% more running time** (Section 3.1.3)
- **50 proposals keep 96% of the accuracy of 300 at about 1/3 of the running time** (Section 4.1.6, Figure 6)
- **Timing hardware: Nvidia GeForce GTX Titan X, Intel Xeon E5-1650 v2, 32 GB RAM; batch size 1; averaged over 500 images; NMS IoU threshold 0.6** (Sections 3.4, 3.5)
- **COCO 2016 winning ensemble: 41.3% mAP@[.5,.95], about 60% relative gain in small-object recall** (Section 4.2, Table 4)

## Why it matters for IntelliSafe

- It gives the method for our own benchmark. We should time YOLOv8n on the Jetson Nano 2GB with batch size 1, include NMS and the compliance engine in the measurement, and average over many frames. The paper shows that post-processing alone can cap the frame rate.
- The resolution result is the strongest evidence for keeping 640x640. Dropping to a smaller input would speed things up but would hit exactly our hardest class: small, far-away helmets.
- YOLO belongs to the single-shot family that this paper finds weak on small objects. That is a known risk for IntelliSafe, and we should report helmet and vest AP separately from fire and smoke, which are usually larger regions.
- Light backbones such as MobileNet keep memory under 1 GB. This supports the idea that small models such as YOLOv8n are the right class for a 2 GB board, while reminding us that memory is a real constraint to measure.
- The finding that strict-IoU and overall mAP move together suggests we should report mAP50-95 alongside our mAP@0.5 target, as a check on box tightness, which our IoU-based helmet-to-worker association depends on.

## How to use it in the report or viva

"Fair speed comparisons require the same hardware, batch size and inclusion of post-processing, so all IntelliSafe FPS figures are measured end-to-end on the Jetson Nano at batch size 1 [Huang et al., 2017]." "We kept a 640x640 input because reducing resolution saves time but substantially lowers accuracy, especially on small objects [Huang et al., 2017]."

## Limits and cautions

- The study is from 2016-2017. It covers SSD, Faster R-CNN and R-FCN, not modern YOLO versions, and none of its models are anchor-free.
- All timing is on a desktop Titan X with TensorFlow, with NMS running on the CPU. Absolute times do not transfer to a Jetson Nano running TensorRT FP16.
- The trends (resolution, small objects, backbone size) are averages over COCO's 80 classes. Our 5-class room dataset may behave differently, so the trends guide our tests but do not replace them.
- The visualisation thresholds (0.5 and 0.3) were hand-tuned for looks, as the authors admit. The paper gives no guidance on choosing an operating confidence threshold for safety alarms.
