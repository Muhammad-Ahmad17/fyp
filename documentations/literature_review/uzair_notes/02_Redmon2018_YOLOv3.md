# YOLOv3: An Incremental Improvement

**Authors / venue / year:** Joseph Redmon, Ali Farhadi / arXiv tech report (arXiv:1804.02767) / 2018  
**PDF:** [02_Redmon2018_YOLOv3.pdf](../uzair_cv_yolo_compliance/02_Redmon2018_YOLOv3.pdf)  
**Pages:** 6 · **Reading priority for IntelliSafe:** Medium  
**In one line:** YOLOv3 adds a stronger Darknet-53 backbone, independent per-class (multilabel) predictions and box predictions at three scales, making YOLO strong on the AP@0.5 metric and much better on small objects while staying fast.

## Explained simply

This is a short, deliberately informal tech report: the authors joke throughout and say they "phone it in". Behind the jokes, it describes a set of changes that shaped every later YOLO version.

First, **anchors** (also called priors). An anchor is a pre-set box shape, such as "tall and thin" or "small and square". The network predicts small adjustments to the anchor instead of drawing a box from nothing. YOLOv3 chooses 9 anchor shapes by k-means clustering of the box sizes in the training data. On COCO the smallest anchor is 10x13 pixels and the largest is 373x326. The network predicts offsets tx, ty, tw, th. The centre is passed through a sigmoid so that it stays inside its grid cell. Each box also gets an **objectness score**, which is the probability that the box contains any object.

Second, **multi-scale prediction**, which is close to a **feature pyramid**. A feature pyramid uses feature maps at several resolutions: coarse maps "see" large objects and context, and fine maps keep the detail needed for small objects. YOLOv3 predicts boxes at 3 scales and uses 3 anchors per scale. The coarse map is upsampled 2x and joined (concatenated) with an earlier, more detailed map, and this is done twice. For a 416x416 input this gives 13x13, 26x26 and 52x52 grids. A 52x52 grid has cells only 8 pixels wide, so a small helmet far from the camera has a much better chance of being caught than with YOLOv1's 7x7 grid.

Third, **multilabel classes**. YOLOv3 does not use a softmax, which forces exactly one class per box. Instead it gives each class its own independent yes/no (logistic) output, trained with binary cross-entropy. This matters when labels can overlap, such as "Woman" and "Person".

Fourth, the **backbone**. The backbone is the feature-extracting part of the network, and here it is a new 53-layer network with residual (shortcut) connections called Darknet-53. It matches ResNet-152 accuracy on ImageNet while running about 2x faster.

Finally, the authors argue about metrics. COCO's main metric averages AP over IoU thresholds from 0.5 to 0.95, which rewards very tight boxes. On that metric YOLOv3 is only average. On the older **AP50** metric (AP at IoU 0.5), YOLOv3 is almost as good as RetinaNet while being about 3.8x faster.

## Summary

YOLOv3 is a tech report describing incremental changes to YOLOv2. Boxes are predicted relative to anchor priors found by k-means clustering (9 clusters on COCO), with a logistic objectness score for each box. Classes are predicted with independent logistic classifiers trained with binary cross-entropy, instead of a softmax. Predictions are made at three scales using an FPN-like design with upsampling and concatenation, with 3 boxes per scale, giving an N x N x [3 x (4 + 1 + 80)] tensor on COCO. The new Darknet-53 backbone has 53 convolutional layers with shortcut connections and matches ResNet-152 accuracy at about twice the speed. At 320x320 YOLOv3 runs in 22 ms at 28.2 mAP, similar to SSD but three times faster. At 608x608 it reaches 57.9 AP50 in 51 ms on a Titan X, compared with RetinaNet's 57.5 AP50 in 198 ms. Small-object AP improves, but accuracy falls at higher IoU thresholds. The authors list failed ideas, including focal loss and linear offset predictions, and close with an ethics reflection and a critique of the COCO metric.

## Key points

- Anchor priors come from k-means clustering of training boxes: 9 clusters split evenly across 3 scales, ranging from 10x13 to 373x326 pixels on COCO.
- Only one anchor is assigned to each ground-truth object. Anchors that overlap an object by more than 0.5 but are not the best match are ignored during training.
- Independent logistic classifiers replace the softmax, which allows overlapping labels and multilabel datasets.
- Predicting at three scales, with upsampled deep features joined to earlier detailed features, gives fine-grained information for small objects.
- Darknet-53 reaches 77.2% top-1 and 93.8% top-5 on ImageNet at 78 FPS, compared with ResNet-152's 77.6% and 93.8% at 37 FPS (Titan X, 256x256).
- YOLOv3 is strong at IoU 0.5 but drops as the IoU threshold rises, meaning its boxes are good but not perfectly tight.
- Unlike earlier YOLOs, YOLOv3 has relatively high small-object AP (APS), but comparatively weaker medium and large-object AP.
- Focal loss, linear x/y predictions and Faster R-CNN-style dual IoU thresholds were tried and did not help.
- The paper ends with a serious point on ethics: researchers should consider the harm their work might do and think of ways to reduce it.

## Important highlights

> "At 320 × 320 YOLOv3 runs in 22 ms at 28.2 mAP, as accurate as SSD but three times faster." (Abstract, page 1)

> "YOLOv3 predicts boxes at 3 different scales." (Section 2.3, page 2)

> "However, performance drops significantly as the IOU threshold increases indicating YOLOv3 struggles to get the boxes perfectly aligned with the object." (Section 3, page 3)

> "With the new multi-scale predictions we see YOLOv3 has relatively high APS performance." (Section 3, page 3)

**Numbers worth remembering**

- **YOLOv3-320: 28.2 mAP in 22 ms; YOLOv3-416: 31.0 in 29 ms; YOLOv3-608: 33.0 in 51 ms (COCO)** (Figure 1)
- **YOLOv3-608: 57.9 AP50 in 51 ms versus RetinaNet-101-800 57.5 AP50 in 198 ms (Titan X / M40)** (Abstract, Figure 3)
- **YOLOv3-608 on COCO: AP 33.0, AP50 57.9, AP75 34.4, APS 18.3, APM 35.4, APL 41.9** (Table 3)
- **YOLOv2 for comparison: AP 21.6, AP50 44.0, APS 5.0** (Table 3)
- **Darknet-53: 77.2 top-1, 93.8 top-5, 18.7 billion operations, 78 FPS** (Table 2)
- **9 anchors, 3 scales, 3 boxes per scale; tensor N x N x [3 x (4 + 1 + 80)] for COCO** (Sections 2.3)
- **Ignore threshold 0.5 for non-best anchors** (Section 2.1)
- **Focal loss lowered mAP by about 2 points** (Section 4)

## Why it matters for IntelliSafe

- Multi-scale prediction is the main reason modern YOLOs, including our YOLOv8n, can find small, far-away helmets. YOLOv3's APS jumping from 5.0 (YOLOv2) to 18.3 is the clearest evidence in these papers that multi-scale heads help small objects.
- Our acceptance target is mAP@0.5 of at least 0.70, the same AP50 metric YOLOv3 defends. For PPE compliance, a helmet box that is roughly right is enough to associate it with a worker, so the looser IoU 0.5 metric fits our purpose.
- YOLOv3's weakness at high IoU (loose boxes) directly affects our IoU-based association. A loose helmet box can still overlap the worker box, which is one reason our association threshold (about 0.3) is lower than the 0.5 used for scoring detections.
- Independent per-class outputs are a good fit for our classes because boxes can overlap. A helmet box sits inside a worker box, and fire and smoke often appear together.
- The ablation list ("things we tried that didn't work") is a reminder to change one thing at a time when tuning training and to measure each change on our validation set.

## How to use it in the report or viva

"Modern YOLO detectors predict boxes at several scales, an idea introduced to YOLO in version 3, which substantially improved small-object accuracy compared with YOLOv2 [Redmon and Farhadi, 2018]." "We report mAP at IoU 0.5 as our main metric because, as Redmon and Farhadi note, YOLO-style detectors are strong at producing decent boxes even when the boxes are not perfectly aligned [Redmon and Farhadi, 2018]."

## Limits and cautions

- It is an informal, non-peer-reviewed tech report. Many claims (such as why focal loss failed) are admitted guesses, so do not present them as proven findings.
- Speeds are from Titan X or M40 desktop GPUs at 320 to 608 pixel input. They give no information about a Jetson Nano 2GB with TensorRT FP16.
- YOLOv3 is anchor-based. YOLOv8 is anchor-free (see the Terven review), so details such as k-means anchors and the 0.5 ignore threshold do not apply directly to our model.
- Results are on COCO's 80 classes. Small-object AP of 18.3 is still low in absolute terms, so small helmets remain a real risk even with multi-scale heads.
