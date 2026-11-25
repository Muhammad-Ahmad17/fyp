# PPE Compliance Detection on Construction Sites with YOLOv3

**Authors / venue / year:** Venkata Santosh Kumar Delhi, R. Sankarlal, Albert Thomas (IIT Bombay) / Frontiers in Built Environment, vol. 6, article 136 / 2020  
**PDF:** [09_Delhi2020_PPECompliance_Frontiers.pdf](../uzair_cv_yolo_compliance/09_Delhi2020_PPECompliance_Frontiers.pdf)  
**Pages:** 10 · **Reading priority for IntelliSafe:** High  
**In one line:** The authors fine-tune YOLOv3 to put each person on a construction site into one of four compliance categories (SAFE, NOTSAFE, NoHardhat, NoJacket), report precision, recall and F1 of about 0.96, and raise an alarm with a time-stamped report whenever a non-SAFE person is seen.

## Explained simply

The goal of this paper is very close to ours: look at CCTV-style images and decide automatically whether workers are wearing a hard hat (helmet) and a safety jacket (vest). The authors take YOLOv3, a one-stage object detector that finds objects and draws a **bounding box** (a rectangle) around each one in a single pass, and retrain it on their own construction-site images.

The key design choice is *what* the boxes mean. They do not detect "helmet" and "vest" as separate objects. Each box goes around a **person** and carries a compliance label: SAFE (helmet and jacket), NoHardhat (jacket only), NoJacket (helmet only) or NOTSAFE (neither). So the network itself makes the compliance decision. There is no separate rule step afterwards.

They use **transfer learning**. This means starting from YOLOv3 weights already trained on a large general dataset and continuing training on a small new dataset, so the network does not have to learn basic visual features from scratch. They changed the final layer to output 4 classes and trained in stages, first with most layers frozen and then with all layers unfrozen.

To measure quality they build a **confusion matrix**, a table of "what the human said" against "what the model said" for every labelled box. From it they compute, per class: **precision** = TP / (TP + FP), meaning "when the model says NoHardhat, how often is it right?"; **recall** = TP / (TP + FN), meaning "of all real NoHardhat people, how many did the model find?"; and **F1**, the harmonic mean of the two. A **false positive (FP)** is a wrong alarm and a **false negative (FN)** is a missed violation. One example from their validation set: the model said NoHardhat 77 times, 75 correctly and 2 wrongly, giving precision 75/77 = 0.97. It missed none of the real NoHardhat cases, so recall was 1.00.

Picture two workers side by side, one without a helmet. A good model draws one box around each worker, labels one SAFE and the other NoHardhat, and the system raises an alarm for the second. The authors also tested on video. The label changed from SAFE to unsafe when a person removed a hard hat or jacket, and changed back when the PPE was put on again.

## Summary

The paper proposes a computer-vision framework to detect PPE non-compliance on Indian construction sites in near real time. A YOLOv3 network (Keras/TensorFlow) is fine-tuned by transfer learning to output four person-level classes: NOTSAFE, SAFE, NoHardhat and NoJacket. The dataset has 2,509 images with 4,132 labelled data points. It combines 260 frames taken from site videos every 3 seconds with about 1,500 filtered web-scraped images, plus flips and ±30 degree rotations. The data are split 90:8:2 into training, validation and test sets. On the validation set the model reaches 96.27% accuracy, with average precision, recall and F1 of 0.96. On the 54-image test set it reaches 96.51% accuracy and 0.97 for each average. On a separate "novel" set with different PPE styles it reaches 96.92% accuracy and F1 0.96. On a desktop CPU it processes 1 to 2 images per second and about 2 frames per second on video. A module raises an alarm and writes a time-stamped report when a non-SAFE class is detected. The authors list occlusion, hard-hat colour mismatch and low frame rate as limitations.

## Key points

- Compliance is encoded directly in the class label, so a single box on a person says SAFE, NOTSAFE, NoHardhat or NoJacket.
- Transfer learning from pretrained YOLOv3 weights let the authors train a useful model from only about 2,500 images.
- Most of the data came from web scraping, with only 260 images taken from real site video to approximate CCTV footage.
- The paper reports per-class TP, TN, FP, FN, precision, recall and F1 in Tables 3, 5 and 7, not just one headline number.
- The weakest result is NoHardhat recall of 0.80 on the novel dataset (Table 7), where two NoHardhat people were labelled SAFE.
- Testing on a "novel" dataset with unseen PPE styles was used to estimate real-world performance.
- On video, the label correctly switched between SAFE and unsafe when a worker took PPE off or put it back on.
- Speed was only about 2 frames per second on an Intel i7 CPU with integrated graphics, which the authors admit limits real-time use.
- Congested sites with occlusion, and colour mismatch for hard hats, are named as the main sources of error.

## Important highlights

> "F1 score of 0.96 with an average precision and recall rate at 96% on the test data" (Abstract, page 1)

> "construction sites in countries such as India are more labor-intensive and congested" (Research Background, page 4)

> "there are occlusions and overlapping frames of objects in images of construction sites" (Research Background, page 4)

> "Each image was processed at speeds of between 2 images per second and 1 image per second" (Results, page 6)

> "color mismatching (especially for hard hats)" (Conclusion, page 8)

**Numbers worth remembering**

- **Dataset: 2,509 images, 4,132 data points; split 2,217 / 238 / 54 images (90:8:2)** (Data Set Preparation, Table 1)
- **Validation: accuracy 96.27%, average precision = recall = F1 = 0.96** (Tables 2 and 3)
- **Test: accuracy 96.51%, average precision = recall = F1 = 0.97** (Tables 4 and 5)
- **Novel set: accuracy 96.92%, precision 0.98, recall 0.95, F1 0.96; NoHardhat recall 0.80** (Tables 6 and 7)
- **Precision = TP / (TP + FP); Recall = TP / (TP + FN); F1 = 2 x P x R / (P + R)** (Equations 2 to 4)
- **Training: Adam, initial learning rate 0.001, final YOLO loss 12.06 after three stages** (Training section)
- **Speed: about 2 fps on video, CPU-only desktop (Intel i7-4790, 8 GB RAM)** (Environment Setup, Performance of the Video File)

## Why it matters for IntelliSafe

- **Class design comparison.** Delhi et al. use person-level compliance classes. IntelliSafe detects separate objects (worker, helmet, vest) and decides compliance afterwards in the compliance engine. Our approach scales better: a new PPE item adds one class instead of doubling the number of combined states. It also gives separate helmet_missing and vest_missing alerts for free. The cost is that we must associate each helmet and vest with the right worker. That is exactly where this paper warns that overlapping workers cause trouble.
- **Alarm behaviour.** The paper alarms as soon as a non-SAFE class appears, with no debouncing. IntelliSafe's rule that a violation must persist for N frames, followed by one alert per worker per violation type, directly addresses the label flicker that any frame-by-frame classifier will produce.
- **Evidence.** Their time-stamped report, and their suggested future "report with screenshots", match IntelliSafe's evidence frame saved with every alert.
- **Hard cases confirmed.** Occlusion and hard-hat colour mismatch are on our hard-case list too. We should include crowded and badly lit frames in our own training and test sets.
- **Evaluation style.** Reporting per-class precision, recall and F1, and testing on footage the model never saw (their "novel" set), is a good template for our results chapter. We should report this alongside our mAP@0.5 target of 0.70 or higher.
- **Speed.** At 2 fps on a CPU, their system shows why IntelliSafe plans YOLOv8n with TensorRT FP16 on a Jetson Nano rather than a full-size model.

## How to use it in the report or viva

"Delhi et al. showed that a fine-tuned YOLOv3 can classify construction workers into four PPE compliance states with an F1 score of about 0.96, and that occlusion and hard-hat colour mismatch remain the main error sources [Delhi et al., 2020]." "Unlike their person-level compliance classes, IntelliSafe detects worker, helmet and vest separately and applies an IoU-based association rule. This keeps the class list small and gives a separate alert type for each missing item [Delhi et al., 2020]."

## Limits and cautions

- The test set is only 54 images, so the 96 to 97% figures have wide uncertainty. Their "accuracy" counts correctly labelled boxes and is not mAP, so it cannot be compared directly with our mAP@0.5 target.
- The abstract quotes F1 0.96 "on the test data", but Table 5 gives 0.97 for the test set. The 0.96 figure matches the validation set (Table 3) and the novel set (Table 7). Cite the table values.
- The setting is outdoor construction sites with mostly web-scraped images. IntelliSafe watches a single indoor room with a fixed camera, so the lighting, viewpoint and PPE styles differ. Fire and smoke are not covered at all.
- The model is YOLOv3 on a desktop CPU from 2020. The speed results say nothing about YOLOv8n or the Jetson Nano, and the dataset is only "available on request".
