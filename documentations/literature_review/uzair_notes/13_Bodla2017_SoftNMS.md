# Soft-NMS — Improving Object Detection With One Line of Code

**Authors / venue / year:** Navaneeth Bodla, Bharat Singh, Rama Chellappa, Larry S. Davis (University of Maryland) / ICCV 2017 (arXiv:1704.04503v2) / 2017  
**PDF:** [13_Bodla2017_SoftNMS.pdf](../uzair_cv_yolo_compliance/13_Bodla2017_SoftNMS.pdf)  
**Pages:** ~9 · **Reading priority for IntelliSafe:** Medium–High  
**In one line:** Soft-NMS replaces hard deletion of overlapping boxes with a score decay that depends on IoU, so nearby objects (two workers side by side) are less likely to be erased as duplicates.

## Explained simply

A detector often outputs several overlapping boxes for the same object. **Non-maximum suppression (NMS)** cleans that up. Classic NMS: sort boxes by score, keep the top box **M**, and **delete** every other box whose IoU with M is above a threshold **Nt**. That hard cut is the problem. If a second real object (another worker, another horse) sits next to M and overlaps it enough, its box is thrown away and you get a **miss**.

Soft-NMS keeps every box but **lowers its score** as a function of overlap with M. High overlap → score almost zero. Low overlap → score almost unchanged. Boxes that fall below a tiny score floor are dropped later. Two decay functions are proposed:

- **Linear:** \(s_i = s_i \times (1 - \mathrm{iou}(M, b_i))\) when IoU ≥ Nt (else unchanged)
- **Gaussian (preferred):** \(s_i = s_i \cdot e^{-\mathrm{iou}(M,b_i)^2 / \sigma}\) for all remaining boxes

No re-training is required. You only change the post-processing step. Complexity stays the same as greedy NMS.

## Summary

The paper shows that greedy NMS with a hard IoU threshold is a silent source of misses when objects occlude or stand close together, and that raising Nt to keep more boxes also raises false positives under COCO-style multi-threshold mAP. Soft-NMS decays detection scores continuously with overlap instead of setting them to zero. On PASCAL VOC 2007 it gains about **1.7%** coco-style mAP for both R-FCN and Faster R-CNN. On MS-COCO it gains about **1.3%** (R-FCN) and **1.1%** (Faster R-CNN). With Deformable R-FCN, Soft-NMS lifts a single-model result from **39.8% to 40.9%**. Gains hold across detectors without extra hyperparameters beyond σ for the Gaussian form. The method is easy to drop into any pipeline and needs no extra training.

## Key points

- Classic NMS: hard delete if IoU(M, bi) ≥ Nt → nearby second objects can vanish.
- Soft-NMS: rescale score with a continuous penalty of IoU; never hard-zero at the NMS step.
- Gaussian penalty \(e^{-\mathrm{iou}^2/\sigma}\) is smoother than the linear form and is the main recommendation.
- No re-training; same asymptotic cost as greedy NMS.
- Gains are modest but consistent on VOC and COCO for R-FCN / Faster R-CNN / Deformable R-FCN.
- Especially helpful when evaluation cares about high IoU thresholds (COCO-style), where a deleted neighbour hurts AP.

## Important highlights

> Soft-NMS obtains consistent improvements for the coco-style mAP metric on standard datasets like PASCAL VOC 2007 (1.7% for both R-FCN and Faster-RCNN) and MS-COCO (1.3% for R-FCN and 1.1% for Faster-RCNN) by just changing the NMS algorithm without any additional hyper-parameters.

(Abstract)

> Soft-NMS improves state-of-the-art in object detection from 39.8% to 40.9% with a single model.

(Abstract)

> The computational complexity of Soft-NMS is the same as traditional NMS … Soft-NMS does not require any extra training and is simple to implement.

(Abstract)

**Facts worth remembering:**

- **Problem:** if another object lies inside the overlap threshold of M, greedy NMS causes a miss (Figure 1 horse example: scores 0.95 and 0.80).
- **Gaussian update:** \(s_i \leftarrow s_i \exp(-\mathrm{iou}(M,b_i)^2 / \sigma)\).
- **Drop-in:** change the red hard-delete branch in Algorithm 1 to the green score-decay branch (Figure 2).
- **Public code** was released with the paper (GitHub link in abstract).

## Why it matters for IntelliSafe

- Our hardest PPE case is **two workers close together**. Hard NMS can delete the second worker or their helmet/vest boxes. Soft-NMS (or DIoU-NMS from Zheng 2020) is the literature fix for that exact failure.
- Compliance association (`iou.py`, IoU ≈ 0.3) and detector NMS are different stages. Soft-NMS improves the **detector’s box list** before compliance; it does not replace worker–PPE matching.
- Easy viva line: “We can improve crowded scenes without retraining by replacing greedy NMS with Soft-NMS [Bodla et al., 2017].”
- Ultralytics / YOLO pipelines already expose NMS settings; Soft-NMS is a justified experiment if close workers cause misses on the Jetson demo.

## How to use it in the report or viva

"Greedy NMS deletes overlapping boxes above a fixed IoU threshold, which can remove a second worker standing next to the first. Soft-NMS instead decays scores as a continuous function of overlap and needs no retraining [Bodla et al., 2017]."

## Limits and cautions

- Gains are ~1–2% mAP on general detection; they are not PPE- or fire-specific numbers.
- Still a post-process; it does not fix a weak model or tiny far helmets.
- σ must be tuned; a bad σ can leave too many duplicates or still over-suppress.
- Pair with Zheng’s DIoU-NMS note: both attack “nearby object deleted,” Soft-NMS via score decay, DIoU-NMS via centre-aware IoU.
