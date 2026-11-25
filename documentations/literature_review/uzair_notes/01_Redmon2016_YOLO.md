# You Only Look Once (YOLOv1)

**Authors / venue / year:** Joseph Redmon, Santosh Divvala, Ross Girshick, Ali Farhadi / CVPR / 2016 (arXiv:1506.02640v5)  
**PDF:** [01_Redmon2016_YOLO.pdf](../uzair_cv_yolo_compliance/01_Redmon2016_YOLO.pdf)  
**Pages:** 10 · **Reading priority for IntelliSafe:** High  
**In one line:** YOLO treats object detection as one regression problem solved by a single neural network pass over the whole image, which made real-time detection possible at the cost of weaker localization, especially for small objects.

## Explained simply

Object detection means finding *what* is in an image and *where* it is. The "where" is a **bounding box**: a rectangle given by its centre (x, y), width (w) and height (h). Before YOLO, most detectors first proposed many candidate regions (about 2000 for R-CNN) and then ran a classifier on each one, which was accurate but slow.

YOLO does everything in one pass. The image is resized to 448x448 and split into a 7x7 **grid**, so each **grid cell** covers 64x64 pixels. If an object's centre falls inside a cell, that cell is responsible for detecting it. Each cell predicts 2 boxes, each with a **confidence score** defined as Pr(Object) x IoU, plus one set of class probabilities. On PASCAL VOC (20 classes) the whole output is a 7 x 7 x 30 tensor.

**IoU (Intersection over Union)** measures box overlap: the area two boxes share divided by the total area they cover. 1 means a perfect match and 0 means no overlap. At test time YOLO multiplies class probability by box confidence, giving a score that captures both "is this a helmet?" and "how well does the box fit?". **Non-maximum suppression (NMS)** then removes duplicates by keeping the highest-scoring box and dropping others that overlap it heavily; the paper says NMS adds 2 to 3% mAP.

**mAP (mean average precision)** is the standard accuracy score. For each class, detections are ranked by confidence and a precision-recall curve is drawn; the area under it is that class's AP, and mAP averages the APs. On VOC a detection is correct when its IoU with the true box is above 0.5, the same idea as "AP@0.5". **FPS (frames per second)** measures speed, and the paper calls 30 FPS or more "real-time".

A small example shows the main weakness. Picture two workers standing close together at the back of the room, each helmet about 20 pixels wide. If both helmet centres fall into the same 64x64 cell, that cell has only one set of class probabilities and two boxes, so one helmet may be missed. The network also downsamples the image many times, so its features are coarse.

## Summary

The paper introduces YOLO, a unified detector that frames object detection as regression from image pixels directly to bounding-box coordinates and class probabilities, using one convolutional network evaluated once per image. The network has 24 convolutional layers and 2 fully connected layers, is pretrained on ImageNet at 224x224 and is fine-tuned for detection at 448x448. The image is divided into a 7x7 grid, and each cell predicts two boxes with confidences plus 20 class probabilities. Training uses a sum-squared error loss weighted by λcoord = 5 and λnoobj = 0.5. On PASCAL VOC 2007, YOLO reaches 63.4% mAP at 45 FPS and Fast YOLO reaches 52.7% mAP at 155 FPS on a Titan X. Error analysis shows YOLO makes more localization errors but far fewer background false positives than Fast R-CNN, and combining the two raises Fast R-CNN to 75.0% mAP. YOLO also generalises better than R-CNN and DPM to artwork. The stated limitations are small objects in groups, unusual aspect ratios and coarse localization.

## Key points

- YOLO replaces the multi-stage proposal-plus-classifier pipeline with a single network trained end-to-end on detection performance.
- Each grid cell predicts B boxes (x, y, w, h, confidence) and one set of C class probabilities, so the output is S x S x (B x 5 + C).
- Box confidence is Pr(Object) x IoU with the ground truth, so it encodes both object presence and box fit.
- The base model runs at 45 FPS and Fast YOLO (9 convolutional layers instead of 24) at 155 FPS on a Titan X GPU.
- Because YOLO sees the whole image, it makes far fewer background false positives than Fast R-CNN (4.75% of top detections versus 13.6%).
- Localization is YOLO's biggest error source (19.0% versus 8.6% for Fast R-CNN), caused by coarse features and the grid constraint.
- Training uses ImageNet pretraining, dropout and augmentation: random scaling and translation up to 20%, and exposure and saturation changes up to a factor of 1.5 in HSV colour space.

## Important highlights

> "Using our system, you only look once (YOLO) at an image to predict what objects are present and where they are." (Section 1, page 1)

> "Our model struggles with small objects that appear in groups, such as flocks of birds." (Section 2.4, page 4)

> "Our main source of error is incorrect localizations." (Section 2.4, page 4)

> "Fast R-CNN is almost 3x more likely to predict background detections than YOLO." (Section 4.2, page 6)

**Numbers worth remembering**

- **Input 448x448, grid 7x7, B = 2, C = 20, output 7x7x30** (Sections 2, 2.1)
- **YOLO: 63.4% mAP at 45 FPS; Fast YOLO: 52.7% mAP at 155 FPS; PASCAL VOC 2007, Titan X** (Table 1)
- **Fast R-CNN: 70.0% mAP at 0.5 FPS; Faster R-CNN VGG-16: 73.2% at 7 FPS** (Table 1)
- **Background errors 4.75% (YOLO) versus 13.6% (Fast R-CNN); localization errors 19.0% versus 8.6%** (Figure 4)
- **Fast R-CNN + YOLO: 75.0% mAP on VOC 2007 (+3.2)** (Table 2)
- **VOC 2012 test: YOLO 57.9% mAP** (Table 3)

## Why it matters for IntelliSafe

- It explains the core idea behind our YOLOv8n model. One forward pass per frame is what makes real-time PPE and fire monitoring on a Jetson Nano 2GB realistic, where a two-stage detector would not be.
- The confidence and IoU definitions are the same ideas used in our pipeline: NMS removes duplicate boxes, and our compliance engine (`iou.py`, threshold about 0.3) uses IoU to attach each helmet and vest box to a worker box.
- The stated weakness on small, grouped objects matches our hardest case, small far-away helmets on workers standing close together. It is why we rely on a later multi-scale YOLO and keep the 640x640 input.
- YOLO's low background false-positive rate is encouraging for fire and smoke, where a false CRITICAL alarm would train workers to ignore the siren, but it was measured on VOC objects, not flames or smoke.
- The augmentation used here (scaling, translation, exposure and saturation) is a simple, proven way to stretch a 200 to 500 image dataset across the room's lighting conditions.

## How to use it in the report or viva

"IntelliSafe uses a single-stage detector from the YOLO family because YOLO frames detection as a single regression from pixels to boxes and class probabilities, which allows real-time inference [Redmon et al., 2016]." "The original YOLO paper reports that the method struggles with small objects that appear in groups, so we treat small, distant helmets as a known risk and evaluate them separately [Redmon et al., 2016]."

## Limits and cautions

- The results are from 2015-2016, on PASCAL VOC with a desktop Titan X GPU; they say nothing about Jetson Nano speed or about PPE, fire or smoke accuracy.
- The architecture (fully connected output, 7x7 grid, 2 boxes per cell) is obsolete, and YOLOv8n differs in almost every component, so cite this paper for the concept, not the numbers.
- The 63.4% is VOC AP at IoU 0.5 on 20 classes and is not comparable to COCO mAP@[.5:.95] or to our 5-class mAP@0.5 target of 0.70.
- The paper does not cover tracking, temporal smoothing or rule logic; our worker_id, debounce and compliance score are our own design.
