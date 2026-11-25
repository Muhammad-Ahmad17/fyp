# A Comprehensive Review of YOLO (YOLOv1 to YOLOv8 and YOLO-NAS)

**Authors / venue / year:** Juan R. Terven, Diana M. Cordova-Esparza / Machine Learning and Knowledge Extraction (journal) / 2023 (arXiv:2304.00501v7, Feb 2024)  
**PDF:** [04_Terven2023_YOLO_Review.pdf](../uzair_cv_yolo_compliance/04_Terven2023_YOLO_Review.pdf)  
**Pages:** 36 · **Reading priority for IntelliSafe:** High  
**In one line:** A survey that explains detection metrics and NMS and then walks through every major YOLO version, showing how the family moved from anchor-based heads to anchor-free, decoupled heads (YOLOv8) offered in nano-to-extra-large sizes for different hardware.

## Explained simply

The review starts with the tools needed to read any detection paper. **Precision** is the share of predicted boxes that are correct, and **recall** is the share of real objects that were found. Raising the **confidence threshold** usually raises precision and lowers recall. **IoU** is the overlap between two boxes divided by their combined area. **AP** is the area under the precision-recall curve for one class, and mAP averages AP over classes. On VOC a box counts as correct at IoU 0.5 (this is **AP50** or mAP@0.5). COCO averages AP over IoU thresholds from 0.5 to 0.95 in steps of 0.05 (mAP50-95). The paper also gives the **NMS** algorithm step by step: drop boxes below a confidence threshold T, keep the highest-scoring box, delete any remaining box whose IoU with it is at least τ, and repeat.

Next it defines **backbone, neck and head**. The backbone extracts features, with edges and textures in early layers and object parts in deeper layers. The neck (for example FPN or PAN) mixes features across scales. The head outputs boxes and classes, and NMS cleans up the result.

The key design change for us is **anchors versus anchor-free**. From YOLOv2 to YOLOv5, the head adjusted pre-set anchor boxes. YOLOv5 even includes a tool (AutoAnchor) that re-fits anchors to your dataset using k-means and a genetic algorithm. YOLOX (2021) showed that an **anchor-free** head, which predicts the box directly with no pre-set shapes, can match or beat anchors, and later versions dropped anchors. YOLOv8 is anchor-free and uses a **decoupled head**, meaning separate branches for classification and box regression, so each branch can specialise.

YOLOv5 and YOLOv8 both come in five **scaled sizes**: n (nano), s (small), m (medium), l (large) and x (extra large). They share the same design but differ in network width and depth. As an example, YOLOv8n and YOLOv8x see the same 640x640 frame; the nano model has far fewer parameters, so it runs faster on a small device but is less accurate. The review's Figure 21 shows the trend: more parameters give higher COCO mAP, and lower latency usually means lower accuracy.

YOLOv8 itself uses a CSPDarknet-style backbone with a new **C2f** block, an SPPF layer (fast spatial pyramid pooling), CIoU plus DFL losses for boxes, and binary cross-entropy for classes. The authors note that these losses help particularly with smaller objects. YOLOv8x reaches 53.9% AP on COCO at 640 pixels.

## Summary

Terven and Cordova-Esparza review 16 YOLO variants, from YOLOv1 (2015) to YOLOv8 and YOLO-NAS (2023), plus transformer-based hybrids. They first explain precision, recall, IoU, how AP is computed on VOC (11-point, IoU 0.5) and COCO (101-point, IoU 0.5 to 0.95), and the NMS algorithm. Each version is then described by its backbone, neck, head, losses and training tricks. YOLOv5 (Ultralytics, PyTorch) introduced AutoAnchor, a CSPDarknet53 backbone with SPPF and CSP-PAN, strong augmentation, and five scaled models (n/s/m/l/x). YOLOv8 (Ultralytics, January 2023) keeps the five sizes but switches to an anchor-free, decoupled head with C2f modules, CIoU and DFL box losses, and binary cross-entropy for classes. It reaches 53.9% AP at 640 pixels, against 50.7% for YOLOv5x. The discussion summarises trends in a comparison table: the move from anchors to anchor-free since YOLOX, from Darknet to PyTorch, and from hand-designed to NAS-designed backbones. A constant theme is the speed versus accuracy trade-off, now offered through model scales for different hardware.

## Key points

- AP on COCO averages over 10 IoU thresholds (0.5 to 0.95), while AP50 uses only IoU 0.5. VOC and COCO numbers cannot be compared directly.
- NMS uses two settings, a confidence threshold T and an IoU threshold τ, and both affect how many duplicate or false boxes survive.
- YOLOv5 offers YOLOv5n, s, m, l and x by varying width and depth. The n and s models target low-resource devices, and x targets maximum accuracy.
- YOLOv5's AutoAnchor re-fits anchors to the dataset, which shows that anchor-based models depend on anchors matching the object sizes.
- YOLOX's anchor-free head added 0.9 AP over its YOLOv3 baseline, and its decoupled head added 1.1 AP and sped up convergence.
- YOLOv8 is anchor-free with a decoupled head, uses C2f blocks and SPPF, and trains boxes with CIoU plus DFL and classes with binary cross-entropy.
- YOLOv8x reaches 53.9% AP at 640 pixels and 280 FPS on an NVIDIA A100 with TensorRT, compared with 50.7% for YOLOv5x at the same input size.
- Figure 21 compares YOLOv5 to YOLOv8 model scales. Accuracy rises with parameter count, and lower latency (A100, TensorRT FP16) usually means lower mAP.
- The only embedded-board figure in the review is YOLOv4-tiny at 46 FPS on a Jetson TX2 with 22% COCO AP.

## Important highlights

> "YOLOv5n and YOLOv5s are lightweight models targeted for low-resource devices, while YOLOv5x is optimized for high performance, albeit at the expense of speed." (Section 9.1, page 16)

> "YOLOv8 uses an anchor-free model with a decoupled head to independently process objectness, classification, and regression tasks." (Section 16.1, page 22)

> "These losses have improved object detection performance, particularly when dealing with smaller objects." (Section 16.1, page 22)

> "Since then, subsequent YOLO versions have abandoned the use of anchors." (Section 20, page 28)

> "Lower latency values, indicating faster model inference, typically result in reduced accuracy." (Section 20.1, page 29)

**Numbers worth remembering**

- **YOLOv8x: 53.9% AP on COCO test-dev at 640 px, 280 FPS on A100 with TensorRT** (Section 16.1)
- **YOLOv5x: 50.7% AP at 640 px, 200 FPS on V100 at batch size 32; 55.8% AP at 1536 px with test-time augmentation** (Section 9.1)
- **YOLOv4: 43.5% AP, 65.7% AP50 on COCO** (Section 8)
- **YOLOv4-tiny: 46 FPS on Jetson TX2, 440 FPS on RTX 2080 Ti, 22% AP** (Section 10)
- **YOLOX: anchor-free +0.9 AP; decoupled head +1.1 AP; 50.1% AP** (Section 12)
- **YOLOv1 63.4 and YOLOv2 78.6 on VOC2007** (Sections 4.1, 5; Table 4)
- **COCO AP uses 101 recall points and IoU 0.5 to 0.95 in steps of 0.05; VOC uses 11 points** (Section 3.2)
- **Table 4 summary: YOLOv8, 2023, anchor-free, PyTorch, 53.9 AP; YOLO-NAS, 52.2 AP at 16-bit** (Table 4)
- The review gives **no per-size numbers (n/s/m/l/x) in the text**; YOLOv8n figures only appear graphically in Figure 21.

## Why it matters for IntelliSafe

- It is our main source for describing YOLOv8: anchor-free, decoupled head, C2f, SPPF, CIoU and DFL. Being anchor-free means we do not need to re-tune anchors for our small helmets and large fire regions. The head simply predicts boxes, which is convenient with a small custom dataset.
- The n/s/m/l/x scaling explains why we chose YOLOv8n. The Jetson Nano 2GB is a low-resource device, and the review states that the small variants are aimed at such hardware, accepting lower accuracy for speed.
- The reported benefit of CIoU and DFL for smaller objects matters for far-away helmets. It does not remove the need to test small helmets separately on our validation set.
- The NMS algorithm and the precision/recall trade-off map directly onto our settings. We can use a higher confidence threshold for fire and smoke to protect precision, so the CRITICAL alarm is not ignored, and check that recall stays acceptable.
- The metric section tells us to state clearly that our 0.70 target is mAP@0.5 (AP50), not COCO mAP50-95, and that the two should not be compared.
- Figure 21 uses TensorRT FP16, the same precision mode as our deployment, but on an A100. We must measure our own FPS on the Nano and not reuse those numbers.

## How to use it in the report or viva

"We selected YOLOv8n because YOLOv8 uses an anchor-free, decoupled head and is offered in five scales, with the nano variant designed for low-resource devices at some cost in accuracy [Terven and Cordova-Esparza, 2023]." "Our accuracy target is expressed as mAP at IoU 0.5, which is computed differently from the COCO mAP over IoU 0.5 to 0.95 reported for most YOLO models [Terven and Cordova-Esparza, 2023]."

## Limits and cautions

- This is a review, not an experiment. Most numbers are copied from original papers or Ultralytics material, measured on different GPUs (V100, A100, T4) and settings, so they are not a controlled comparison.
- Some details are inconsistent and should be checked against primary sources. Table 4 lists YOLOv5 at 55.8 AP (1536 px with test-time augmentation) next to YOLOv8 at 53.9 AP (640 px). Table 4 also names YOLOv2's backbone "Darknet24", while Section 5.1 says Darknet-19.
- The review says YOLOv8's head has an objectness output. Before quoting that in the report, check it against the Ultralytics documentation, because YOLOv8's decoupled head is often described with only box and class branches.
- There are no results on PPE, fire or smoke, and no Jetson Nano measurements. The nearest edge figure is for YOLOv4-tiny on a Jetson TX2, which is a different board.
