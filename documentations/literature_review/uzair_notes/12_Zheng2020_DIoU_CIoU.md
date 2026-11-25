# Distance-IoU and Complete-IoU Losses (DIoU / CIoU)

**Authors / venue / year:** Zhaohui Zheng, Ping Wang, Wei Liu, Jinze Li, Rongguang Ye, Dongwei Ren (Tianjin University and others) / AAAI Conference on Artificial Intelligence (PDF is arXiv:1911.08287v1) / 2020  
**PDF:** [12_Zheng2020_DIoU_CIoU.pdf](../uzair_cv_yolo_compliance/12_Zheng2020_DIoU_CIoU.pdf)  
**Pages:** 8 · **Reading priority for IntelliSafe:** Medium  
**In one line:** The paper adds a centre-distance penalty to the IoU loss (DIoU), then an aspect-ratio penalty as well (CIoU), so that predicted boxes move onto target boxes faster and more accurately, and it uses the same distance idea to make NMS less likely to delete boxes of nearby, overlapping objects.

## Explained simply

A detector predicts a **bounding box** for each object, and during training it has to learn to place that box exactly on the true box (the **ground truth**). The function that measures "how wrong is this box?" is the **regression loss**, and gradient descent nudges the box to make that loss smaller. The standard way to judge box quality is **IoU (Intersection over Union)**: the area where the two boxes overlap divided by the total area they cover together. IoU is 1 for a perfect match and 0 when the boxes do not touch.

The obvious loss is **IoU loss = 1 − IoU**. It has a flaw. When the predicted box does not overlap the target at all, IoU is 0 however far away the box is, so the loss gives no direction to move in (the **gradient** is zero). **GIoU** fixed this by adding a penalty based on the smallest box C that encloses both boxes. The authors show that GIoU first makes the predicted box *bigger* until it overlaps, and only then shrinks it into place, which is slow. When one box sits completely inside the other, the extra GIoU term becomes zero and GIoU behaves exactly like plain IoU loss (Figure 2). In the paper's Figure 2 example, a small predicted box sits at three different positions inside the same target box. All three positions give the same IoU and GIoU loss (0.75). DIoU gives 0.81, 0.77 and 0.75, so it can tell them apart, and the lowest value goes to the box whose centre matches the target's centre.

**DIoU loss** adds a simple term: the squared distance between the two box centres divided by the squared diagonal of the enclosing box. This pulls the centre of the prediction straight towards the centre of the target. **CIoU loss** adds one more term that penalises a difference in **aspect ratio** (width divided by height). Together, CIoU covers the three geometric factors the authors think matter: overlap area, centre distance and aspect ratio.

The second idea is **DIoU-NMS**. A detector usually outputs several overlapping boxes for the same object. **Non-maximum suppression (NMS)** keeps the highest-scoring box and deletes any other box whose IoU with it is above a threshold ε. Picture two workers standing shoulder to shoulder. Their boxes overlap a lot, so normal NMS may delete the second worker as a "duplicate". DIoU-NMS subtracts the centre-distance term from IoU before comparing with the threshold. Boxes whose centres are far apart are therefore treated as probably different objects and are kept.

## Summary

The paper analyses bounding-box regression losses with a large simulation of 1,715,000 regression cases covering different distances, scales and aspect ratios. It shows that IoU loss cannot move non-overlapping boxes and that GIoU loss converges slowly, especially for boxes in horizontal and vertical positions and for boxes that contain each other. The authors propose the DIoU loss, which adds the normalised squared distance between box centres to the IoU loss and converges much faster. They also propose the CIoU loss, which further adds an aspect-ratio consistency term with an adaptive weight α. Both losses are plugged into YOLOv3 and SSD on PASCAL VOC and into Faster R-CNN on MS COCO, and they consistently beat IoU and GIoU losses. CIoU gives the largest gains: for YOLOv3, AP rises from 46.57 to 49.21. Finally, DIoU is used as the suppression criterion in NMS (DIoU-NMS). This gives further small gains and beats standard NMS at every threshold tested between 0.43 and 0.48. CIoU was slightly worse than IoU loss for small objects on COCO.

## Key points

- IoU loss gives zero gradient when boxes do not overlap, so such predictions never move in training.
- GIoU fixes the non-overlap case but converges slowly and degrades to IoU loss when one box encloses the other.
- DIoU adds a penalty equal to the squared centre distance divided by the squared diagonal of the smallest enclosing box.
- CIoU adds an aspect-ratio term αv on top of DIoU, so it considers overlap, centre distance and shape together.
- In the simulation, DIoU matched the target in about 120 iterations, while GIoU had still not converged after 400 (Figure 1).
- All losses are compared under the same detector and training protocol, and the gains hold for YOLOv3, SSD and Faster R-CNN.
- DIoU-NMS keeps boxes whose centres are far from the top box, which helps when objects overlap or occlude each other.
- On COCO small objects, CIoU was slightly below plain IoU loss while DIoU was best, so the aspect-ratio term may not help tiny objects.

## Important highlights

> "which converges much faster in training than IoU and GIoU losses" (Abstract, page 1)

> "overlap area, central point distance and aspect ratio" (Abstract, page 1)

> "DIoU can be easily adopted into non-maximum suppression (NMS) to act as the criterion" (Abstract, page 1)

> "the consistency of aspect ratio may not contribute to the regression accuracy for small objects" (Faster R-CNN on MS COCO, page 6)

**Formulas and numbers worth remembering**

- **IoU = |B ∩ Bgt| / |B ∪ Bgt|; IoU loss = 1 − IoU** (Equations 1 and 2)
- **GIoU loss = 1 − IoU + |C − (B ∪ Bgt)| / |C|**, where C is the smallest box covering both (Equation 3)
- **DIoU loss = 1 − IoU + ρ²(b, bgt) / c²**, where ρ is the distance between the box centres and c is the diagonal of the enclosing box (Equation 7)
- **CIoU loss = 1 − IoU + ρ²(b, bgt) / c² + αv, with v = (4/π²)(arctan(wgt/hgt) − arctan(w/h))² and α = v / ((1 − IoU) + v)** (Equations 9 to 11)
- **DIoU-NMS: keep score si if IoU − ρ²/c² < ε, otherwise set it to 0** (Equation 13)
- **YOLOv3 on VOC 2007 test, AP: IoU loss 46.57, GIoU 47.73, DIoU 48.10, CIoU 49.21, CIoU + DIoU-NMS 49.32 (+5.91% relative)** (Table 1)
- **Faster R-CNN on COCO: AP 37.93 (IoU) to 38.71 (CIoU + DIoU-NMS); AP-small 21.58 (IoU) vs 21.32 (CIoU)** (Table 3)
- **Default NMS thresholds used: ε = 0.45 for YOLOv3 and SSD, 0.50 for Faster R-CNN** (Discussion on DIoU-NMS)

## Why it matters for IntelliSafe

- **It explains our training loss.** Ultralytics YOLOv8 uses CIoU in its box loss, so this paper is the reference for *why* our helmet, vest and worker boxes are trained that way. The paper itself tested YOLOv3, SSD and Faster R-CNN, not YOLOv8.
- **Small helmets.** The finding that the aspect-ratio term may not help small objects is relevant to small or distant helmets. If small-helmet recall is weak, this is one possible reason to mention, but it is not proof.
- **Overlapping workers and NMS.** The occlusion argument for DIoU-NMS is exactly our "two workers standing close" case. Ultralytics applies standard NMS with a configurable IoU threshold. If we see one of two close workers disappearing, we should first tune that threshold, and DIoU-NMS is a documented alternative.
- **Our IoU association rule.** The paper's point that IoU-based measures behave badly when one box sits inside another also applies to `edge/compliance_engine/iou.py`. A helmet box usually lies fully inside the worker box, so its IoU with the worker equals helmet area divided by worker area. For example, a 40x35 helmet inside a 120x300 worker gives IoU = 1,400 / 36,000 ≈ 0.04, far below the 0.3 threshold. A large vest might just pass. We should test this case and consider a containment measure instead, such as intersection divided by PPE-box area, or a centre-inside-worker check.

## How to use it in the report or viva

"YOLOv8 trains its box regression with the Complete-IoU loss, which adds centre-distance and aspect-ratio penalties to the IoU loss. Zheng et al. showed that this converges faster and improves YOLOv3 AP on PASCAL VOC from 46.57 to 49.21 [Zheng et al., 2020]." "Because plain IoU ignores how far apart two box centres are, standard NMS can delete one of two overlapping workers. DIoU-NMS addresses this by also using the centre distance [Zheng et al., 2020]."

## Limits and cautions

- The gains are modest in absolute terms, about 1 to 3 AP points, and the "relative improvement %" numbers in the tables are relative to the IoU-loss baseline, not absolute AP points. Quote them carefully.
- The experiments use YOLOv3, SSD and Faster R-CNN on VOC and COCO. The paper does not test YOLOv8, our 5 classes or PPE data, so it cannot predict our mAP.
- DIoU-NMS was only compared with standard NMS at thresholds from 0.43 to 0.48, and not against Soft-NMS in the main tables.
- Nothing in the paper addresses the association of PPE to workers. The note about our IoU threshold is our own application of the IoU definition and should be verified with real boxes.
