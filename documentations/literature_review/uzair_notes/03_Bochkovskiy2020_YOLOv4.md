# YOLOv4: Optimal Speed and Accuracy of Object Detection

**Authors / venue / year:** Alexey Bochkovskiy, Chien-Yao Wang, Hong-Yuan Mark Liao / arXiv (arXiv:2004.10934) / 2020  
**PDF:** [03_Bochkovskiy2020_YOLOv4.pdf](../uzair_cv_yolo_compliance/03_Bochkovskiy2020_YOLOv4.pdf)  
**Pages:** 17 · **Reading priority for IntelliSafe:** Medium  
**In one line:** YOLOv4 systematically tests many training tricks ("bag of freebies") and cheap architecture add-ons ("bag of specials"), and combines the best of them into a detector that is both fast and accurate and can be trained on a single ordinary GPU.

## Explained simply

By 2020, a modern detector was usually described in three parts. The **backbone** is a network pretrained on ImageNet that turns pixels into features. The **neck** is a set of layers that mixes features from different depths and resolutions; a **Feature Pyramid Network (FPN)** and a **Path Aggregation Network (PAN)** are two such designs. The **head** makes the final box and class predictions. YOLOv4's design is CSPDarknet53 as the backbone, SPP plus PAN as the neck, and the anchor-based YOLOv3 head.

The paper's main contribution is organising and testing tricks in two groups. A **bag of freebies (BoF)** is any change that only affects training, so the model gets more accurate at no extra cost when it runs. Data augmentation is the best example. *Photometric* changes (brightness, contrast, hue, saturation, noise) help with lighting, and *geometric* changes (scaling, cropping, flipping, rotating) help with size and position. A **bag of specials (BoS)** is a plug-in module that adds a little inference cost but gives a clear accuracy gain. Examples are SPP, which enlarges the area of the image each output "sees" (the receptive field), attention modules such as SAM, and better NMS such as DIoU-NMS.

Two freebies are especially easy to picture. **Mosaic** augmentation stitches 4 training images into one, so a single sample contains four different scenes and objects at smaller scales, often outside their usual context. Imagine one training image made from four quarters of factory photos, with each helmet now half its original size. **CIoU loss** trains the box using overlap (IoU), the distance between box centres, and the aspect ratio together. Older losses treated x, y, w and h as independent numbers, whereas CIoU treats the box as one shape.

The authors also explain why a detector needs more than a classifier: a higher input resolution to detect small objects, more layers so the receptive field covers the larger input, and more parameters to handle objects of many sizes. This is why the classifier with the best ImageNet score (CSPResNeXt50) was not the best detector backbone; CSPDarknet53 was.

Finally, **AP50** is AP at IoU 0.5, and **AP** on COCO averages IoU thresholds from 0.5 to 0.95. YOLOv4 reaches 43.5% AP and 65.7% AP50 at about 65 FPS on a Tesla V100 data-centre GPU.

## Summary

YOLOv4 aims to build a detector that runs in real time on conventional GPUs and can be trained on a single GPU such as a 1080 Ti or 2080 Ti. The authors survey detector components and sort improvements into "bag of freebies" (training-only methods such as data augmentation, regularization and better box-regression losses) and "bag of specials" (cheap plug-in modules and post-processing). They select CSPDarknet53 as the backbone, an SPP block and a modified PAN as the neck, and the YOLOv3 anchor-based head. New or modified techniques include Mosaic augmentation, Self-Adversarial Training, Cross mini-Batch Normalization, a point-wise SAM, a concatenation-based PAN and genetic-algorithm hyperparameter search. Ablation studies on ImageNet and MS COCO show which features help the classifier and which help the detector, and show that after BoF and BoS the mini-batch size barely matters. YOLOv4 reaches 43.5% AP (65.7% AP50) on COCO test-dev at about 65 FPS on a Tesla V100, and the authors place it on the Pareto front of speed versus accuracy across Maxwell, Pascal and Volta GPUs.

## Key points

- A detector backbone should be chosen for detection, not for classification: CSPResNeXt50 classified better, but CSPDarknet53 detected better.
- The final architecture is CSPDarknet53 backbone, SPP and PAN neck, and YOLOv3 head, with anchors kept.
- Bag-of-freebies for the detector include CIoU loss, CmBN, DropBlock, Mosaic, Self-Adversarial Training, eliminating grid sensitivity, multiple anchors per ground truth, a cosine annealing schedule, genetic-algorithm hyperparameters and random training shapes.
- Mosaic mixes 4 images, which places objects outside their normal context. It also lets batch normalization see 4 images per layer, reducing the need for large mini-batches.
- In the ablation (Table 4), Mosaic alone raised AP from 38.0% to 39.1%. Combining several freebies with CIoU loss reached 42.4% AP and 64.4% AP50.
- Not every trick helps. In Table 4, some settings lowered AP (for example, one row drops to 33.0%), which shows each change must be measured.
- With BoF and BoS, mini-batch 4 versus 8 gave almost the same AP (41.6% versus 41.7%), so expensive multi-GPU training is not needed.
- Speeds were reported with batch size 1 and *without* TensorRT on three GPU generations, which makes cross-paper comparison fairer.
- The authors thank Glenn Jocher (Ultralytics) for the ideas of Mosaic, genetic-algorithm hyperparameter selection and the grid-sensitivity fix. This links YOLOv4 to the Ultralytics line that produced YOLOv5 and YOLOv8.

## Important highlights

> "We call these methods that only change the training strategy or only increase the training cost as “bag of freebies.”" (Section 2.2, page 3)

> "A reference model which is optimal for classification is not always optimal for a detector." (Section 3.1, page 5)

> "Mosaic represents a new data augmentation method that mixes 4 training images." (Section 3.3, page 6)

> "This result shows that after the introduction of BoF and BoS, it is no longer necessary to use expensive GPUs for training." (Section 4.5, page 9)

**Numbers worth remembering**

- **YOLOv4: 43.5% AP, 65.7% AP50 on MS COCO at about 65 FPS on a Tesla V100** (Abstract)
- **YOLOv4 FPS at input 416 / 512 / 608: 38 / 31 / 23 (Maxwell), 54 / 43 / 33 (Pascal), 96 / 83 / 62 (Volta); AP 41.2% / 43.0% / 43.5%** (Tables 8, 9, 10)
- **YOLOv4-608 small-object AP (APS) 26.7% versus YOLOv3-608 18.3%** (Table 8)
- **CSPDarknet53: 27.6 M parameters, 725x725 receptive field, 52 BFLOPs at 512x512, 66 FPS on RTX 2070** (Table 1)
- **Ablation on CSPResNeXt50-PANet-SPP at 512x512: baseline 38.0% AP; Mosaic 39.1%; best BoF with CIoU 42.4% AP / 64.4% AP50** (Table 4)
- **Mini-batch 4 versus 8 with BoF/BoS: 41.6% versus 41.7% AP** (Table 7)
- **COCO training: 500,500 steps, initial learning rate 0.01, batch 64, mini-batch 8 or 4, single GPU** (Section 4.1)

## Why it matters for IntelliSafe

- With only 200 to 500 labelled images, training-time tricks are our cheapest accuracy gains because they cost nothing on the Jetson at run time. Mosaic, scaling and flipping, plus HSV and brightness changes for the room's varied lighting, are exactly the "freebies" this paper validates.
- Mosaic shrinks objects and mixes contexts, which creates more small-helmet training examples. That targets our small, far-away helmet problem directly.
- The paper supports keeping a higher input resolution for small objects, which backs our decision to train and deploy at 640x640 instead of reducing it for speed.
- CIoU, DIoU-NMS and the grid-sensitivity fix all aim at better box placement. Tighter helmet and vest boxes make our IoU-based helmet-to-worker association (threshold about 0.3) more reliable.
- The single-GPU training message matches our situation: we train once on an ordinary GPU and deploy the exported model (ONNX, then TensorRT FP16) on the Jetson Nano 2GB.

## How to use it in the report or viva

"We rely on training-time augmentation such as Mosaic and photometric changes because these 'bag of freebies' methods improve detector accuracy without increasing inference cost on the edge device [Bochkovskiy et al., 2020]." "YOLOv4 also argues that detectors need higher input resolution to find small objects, which is why IntelliSafe keeps a 640x640 input [Bochkovskiy et al., 2020]."

## Limits and cautions

- All speed numbers are on desktop or data-centre GPUs (GTX Titan X, Titan X Pascal, 1080 Ti, Tesla V100) without TensorRT. None of them predicts Jetson Nano performance.
- The ablations use COCO with about 80 classes and very long training (500,500 steps). Gains such as +1.1 AP from Mosaic may be larger, smaller or absent on our 5-class dataset of a few hundred images.
- YOLOv4 is anchor-based and built in the Darknet framework. Our YOLOv8n is anchor-free and built in PyTorch, so only the training ideas carry over directly, not the architecture.
- The paper does not evaluate fire or smoke and does not report precision at a fixed confidence threshold, which is what matters for avoiding false CRITICAL alarms.
