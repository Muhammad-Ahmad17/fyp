# Efficient CNN Fire Detection and Localization for CCTV (CNNFire)

**Authors / venue / year:** Khan Muhammad, Jamil Ahmad, Zhihan Lv, Paolo Bellavista, Po Yang, Sung Wook Baik / IEEE Transactions on Systems, Man, and Cybernetics: Systems (accepted 2018, issue 2019). The PDF is the authors' manuscript and does not print the venue. / 2018  
**PDF:** [11_Muhammad2018_CNNFireDetection_Surveillance.pdf](../uzair_cv_yolo_compliance/11_Muhammad2018_CNNFireDetection_Surveillance.pdf)  
**Pages:** 13 · **Reading priority for IntelliSafe:** High  
**In one line:** A fine-tuned SqueezeNet-style CNN of only 3 MB classifies CCTV frames as fire or normal with 94.50% accuracy and an 8.87% false-positive rate, beating colour- and motion-based methods, and runs at 4 frames per second on a Raspberry Pi 3.

## Explained simply

Older vision-based fire detectors used hand-made rules, for example "pixels that are red-orange and flicker are fire". The authors argue that these rules fail in real footage. Shadows, sunlight, red clothes and red vehicles all trigger them, and each rule needs its own carefully tuned thresholds. They replace the rules with a **convolutional neural network (CNN)**, a network that learns its own visual features from many labelled examples.

Note that this paper does **image classification**, not object detection. The network looks at a whole frame and outputs two probabilities, "fire" and "normal", and the higher one becomes the label. It does not output bounding boxes like YOLO. To find *where* the fire is, the authors take three internal feature maps (numbers 8, 26 and 32 from the "Fire2/Concat" layer) that respond strongly to flames. They average them and apply a threshold, which turns the result into a black-and-white mask of the fire region. The mask size gives a rough "severity". The rest of the image is passed to an ImageNet classifier to guess what is burning, such as a car or a house.

The model is based on **SqueezeNet**, a small network built from "fire modules" (the name has nothing to do with flames). Each module squeezes the channels with 1x1 filters and then expands them with a mix of 1x1 and 3x3 filters. There are no large fully connected layers, which keeps the model at about 3 MB, compared with 238 MB for AlexNet. They use **transfer learning**: start from ImageNet weights, replace the 1000-class output with 2 classes, and fine-tune for 10 epochs. This raised accuracy from 89.8% to 94.50%.

The important metrics are false positives and false negatives. A **false positive** here is a normal frame called "fire", which means a false alarm. A **false negative** is a real fire that is missed. On the second dataset they also report **precision** (of the frames called fire, how many really were), **recall** (of the real fire frames, how many were caught) and the **F-measure**, which combines the two. A concrete example: a worker in an orange jacket walks past a red wall. A colour rule may shout "fire". A trained CNN has learned shape and texture as well as colour, so it is less likely to be fooled, though not immune.

## Summary

The paper proposes a lightweight CNN for early fire detection in CCTV surveillance. The network is modified from SqueezeNet with the final layer reduced to two classes (fire and normal) and fine-tuned with transfer learning. Experiments use 68,457 images, mainly from Foggia et al.'s 31 videos (Dataset1) and Chino et al.'s 226 images (Dataset2), with 20% used for training and 80% for testing. On Dataset1 the fine-tuned model reaches 94.50% accuracy, 8.87% false positives and 2.12% false negatives. This is better than a fine-tuned AlexNet (94.39%, 9.07% false positives) and earlier colour, shape and motion methods. On Dataset2 it achieves precision 0.86, recall 0.97 and F-measure 0.91. A feature-map selection algorithm chooses fire-sensitive maps for localization, and the segmented area estimates severity. The model is 3 MB and needs 0.72 GFLOPs per image. It runs at 20 fps on a TITAN X GPU and 4 fps on a Raspberry Pi 3. Robustness tests with noise, rotation and cropping are also reported.

## Key points

- Colour-based and motion-based fire detectors produce many false alarms on fire-coloured objects, shadows, sunlight and moving red things.
- The proposed CNN classifies a whole frame as fire or normal, so it is a classifier and not a bounding-box detector.
- Fine-tuning a pretrained network raised accuracy by about 5 points (89.8% to 94.50%) compared with training without fine-tuning.
- Switching from AlexNet to the SqueezeNet-style model shrank the model from 238 MB to 3 MB, with slightly better accuracy and false-positive rate.
- Dataset1 deliberately contains hard normal videos: smoke, sunlight reflected in windows, red buildings, and a person carrying a red ball or bag.
- In Dataset1, smoke-only videos are labelled "Normal", so this system treats smoke without visible flame as non-fire.
- Localization uses three selected feature maps, which are thresholded to segment flame pixels and estimate burning degree.
- Covering the flames with patches made the model output "normal", while a small pasted fire was still detected with about 78% probability.
- The authors argue that checking about one frame per second is enough for fire, because consecutive frames change very little.

## Important highlights

> "Color-based methods typically generate more false alarms" (Section I, page 2)

> "A survey of the existing literature shows that computationally expensive methods have better accuracy" (Section I, page 2)

> "an accuracy of 94.50% and a false positive rate of 8.87%" (Section III.F, page 11)

**Numbers worth remembering**

- **Proposed model after fine-tuning (Dataset1): accuracy 94.50%, false positives 8.87%, false negatives 2.12%** (Table II)
- **Before fine-tuning: 89.8% accuracy, 9.99% false positives, 10.39% false negatives** (Table II)
- **Fine-tuned AlexNet: 94.39%, 9.07% false positives; Foggia et al.: 93.55%, 11.67% false positives, 0% false negatives** (Table II)
- **Dataset2 (after fine-tuning): precision 0.86, recall 0.97, F-measure 0.91** (Table III)
- **Model size 3 MB vs 238 MB (AlexNet); 0.72 vs 2 GFLOPs per image** (Sections I, II.B and III.F)
- **Speed: 20 fps on NVIDIA TITAN X, 4 fps on Raspberry Pi 3 at 320x240** (Section III.F)
- **Data: 68,457 images in total; training set 10,319 (5,258 fire, 5,061 non-fire); 20% train / 80% test** (Section III.A)

## Why it matters for IntelliSafe

- **False alarms are the main enemy.** Even the best model here has an 8.87% false-positive rate. Suppose IntelliSafe checked one frame per second and errors were spread evenly. That rate would mean about five false "fire" frames per minute on normal footage. This is the strongest argument for our N-frame debounce before the CRITICAL siren, and for tuning the fire/smoke confidence threshold towards precision.
- **Our hard cases are their hard cases.** Red and orange objects, sunlight and reflections fooled earlier methods. We should put similar "fire-like but normal" frames into our training data as background images, and into our test set, to measure fire/smoke precision honestly.
- **Smoke is treated differently.** This paper counts smoke without flame as normal, while IntelliSafe treats smoke as a CRITICAL class of its own. We cannot borrow their labels or numbers for smoke.
- **Detector vs classifier.** IntelliSafe gets fire and smoke boxes from the same YOLOv8n pass as PPE. That gives location for the evidence frame directly, without a second network. Fire stays a scene-level alert that is not tied to any worker.
- **Edge feasibility.** A 3 MB model running at 4 fps on a $35 Raspberry Pi supports the idea that useful fire detection can run on cheap edge hardware like our Jetson Nano 2GB.

## How to use it in the report or viva

"Muhammad et al. showed that a compact CNN can detect fire in CCTV frames with 94.5% accuracy, but even this model produced false positives on 8.87% of frames. That is why IntelliSafe requires a fire or smoke detection to persist for several frames before sounding the alarm [Muhammad et al., 2018]." "Their benchmark includes red objects, sunlight and smoke that look like fire, so we include similar hard negatives when we evaluate fire and smoke precision [Muhammad et al., 2018]."

## Limits and cautions

- The paper does not say that the 20% train / 80% test split was made by whole video. Test frames may therefore come from the same videos as training frames, which would make them very similar. Dataset2 was kept out of training, but accuracy on a new room and camera could still be lower.
- It is a two-class image classifier with no smoke class and no bounding boxes, so its numbers cannot be compared directly with YOLOv8 mAP for our fire and smoke classes.
- The work is from 2018 and uses Caffe, SqueezeNet and a Raspberry Pi 3. It says nothing about TensorRT, FP16 or the Jetson Nano.
- The paper does not define exactly how the false-positive percentage is normalised, so quote it as "false positives 8.87% (Table II)" rather than as a precise per-frame rate.
