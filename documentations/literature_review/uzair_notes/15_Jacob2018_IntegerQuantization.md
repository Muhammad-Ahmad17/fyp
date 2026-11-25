# Quantization and Training of Neural Networks for Integer-Arithmetic-Only Inference

**Authors / venue / year:** Benoit Jacob, Skirmantas Kligys, Bo Chen, Menglong Zhu, Matthew Tang, Andrew Howard, Hartwig Adam, Dmitry Kalenichenko (Google) / CVPR 2018 (arXiv:1712.05877v1) / 2018  
**PDF:** [15_Jacob2018_IntegerQuantization.pdf](../uzair_cv_yolo_compliance/15_Jacob2018_IntegerQuantization.pdf)  
**Pages:** ~14 · **Reading priority for IntelliSafe:** High (Jetson / TensorRT path)  
**In one line:** The paper shows how to train and run CNNs with 8-bit integer weights and activations so mobile CPUs run faster with only a small accuracy drop — the academic foundation for TensorFlow Lite / TensorRT-style INT8 deployment.

## Explained simply

Neural nets normally use **32-bit floating point (FP32)** numbers. Phones and edge boards are faster and cooler if they can use **8-bit integers (INT8)** instead. **Quantization** maps a real number \(r\) to an integer \(q\) with an affine rule:

\[
r = S(q - Z)
\]

- **S (scale):** how much one integer step is worth in real units  
- **Z (zero-point):** which integer means exactly 0  

Weights and activations become `uint8` (or similar). Biases often stay **int32**. Matrix multiply is rewritten so the heavy work is integer multiply–add; the scales combine into a constant multiplier applied once.

Training uses **simulated quantization**: the forward pass fakes INT8 rounding while the optimizer still updates floating-point weights. At deploy time the same scheme runs as true integer-only inference. The authors stress testing on **MobileNets** (already small and fast), not only fat models like VGG where compression looks artificially easy.

## Summary

Google proposes an affine quantization scheme for weights and activations (8-bit) with integer-arithmetic-only inference suitable for mobile CPUs such as Qualcomm Snapdragon. They co-design a training procedure that injects fake quantize nodes so the network learns to tolerate quantization, including batch-norm folding into weights before quantizing. On ImageNet, integer ResNet-50 drops from **76.4% to 74.9%** top-1; deeper ResNets show similar ~1.5% gaps. MobileNet latency–accuracy curves on Snapdragon 835 / 821 improve markedly versus float baselines at the same latency budget (gaps of several points of accuracy in the paper’s figures). The same recipe is applied to MobileNet-based detection on COCO. The scheme underpins TensorFlow Lite’s quantization path and is the conceptual ancestor of production INT8 pipelines (including TensorRT calibration on Jetson).

## Key points

- Affinity: \(r = S(q - Z)\) so 0 is exactly representable.
- Weights + activations → 8-bit; biases → 32-bit integers.
- Integer-only matmul: scales fold into a fixed-point multiplier \(M = S_1 S_2 / S_3\).
- Train with simulated quantization; fold batch-norm into weights first.
- Evaluate on efficient nets (MobileNets), not only over-parameterized ones.
- ImageNet ResNet-50: 76.4% float → 74.9% INT8 (~1.5% drop).
- Goal is better **latency vs accuracy**, not compression alone.

## Important highlights

> We propose a quantization scheme that allows inference to be carried out using integer-only arithmetic, which can be implemented more efficiently than floating point inference on commonly available integer-only hardware.

(Abstract)

> The improvements are significant even on MobileNets, a model family known for run-time efficiency, and are demonstrated in ImageNet classification and COCO detection on popular CPUs.

(Abstract)

> \(r = S(q - Z)\) … Equation (1) is our quantization scheme and the constants \(S\) and \(Z\) are our quantization parameters.

(Section 2.1)

**Facts worth remembering:**

- **ResNet ImageNet (Table 4.1):** depth 50 / 100 / 150 → float 76.4 / 78.0 / 78.8% vs INT8 74.9 / 76.6 / 76.7%.
- **Training graph:** fake “wt quant” and “act quant” nodes in the float graph (Figure 1.1b).
- **Hardware shown:** Snapdragon 835 LITTLE / big cores; latency–accuracy plots for MobileNets (Figures 4.1–4.2).
- **TensorFlow / gemmlowp** lineage is explicit in the footnotes.

## Why it matters for IntelliSafe

- Jetson Nano 2GB cannot run a full FP32 YOLO comfortably. **INT8 / FP16 TensorRT** is the deployment story; this paper is the academic citation for “why integer inference exists.”
- Member A’s TensorRT export of Uzair’s YOLOv8n weights is justified by this latency–accuracy tradeoff literature, even though TensorRT’s calibrator differs in detail from TF Lite.
- Expect a **small accuracy drop** after INT8; re-measure mAP@0.5 on the val set after export — do not assume the float checkpoint’s 0.70 target still holds.
- Fire/smoke CRITICAL false negatives are more dangerous than a 1–2% mAP loss; if INT8 hurts hazards, keep FP16 or float for that track.

## How to use it in the report or viva

"To fit YOLOv8n on the Jetson Nano we use integer / reduced-precision inference. Jacob et al. [2018] show that 8-bit affine quantization with simulated training keeps ImageNet accuracy within about 1.5% of float while cutting latency on mobile CPUs; TensorRT applies the same idea on NVIDIA edge GPUs."

## Limits and cautions

- Results are MobileNet / ResNet / Inception on ImageNet and MobileNet detectors on COCO — **not YOLOv8n on Jetson**.
- TensorRT uses its own calibration; do not claim you implemented this exact Google recipe unless you did.
- Aggressive INT8 can hurt rare classes (fire, smoke) more than worker/helmet; always validate per class.
- The paper targets mobile **CPUs**; Jetson’s win is GPU TensorRT / DLA, same idea, different silicon.
