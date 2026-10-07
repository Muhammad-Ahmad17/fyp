# IntelliSafe: Formal References & Citations

**Used in:** DEFENSE_GUIDE.md, PRIOR_RESEARCH_vs_INTELLISAFE.md  
**Date:** Oct 7, 2026

---

## Complete Reference List

### [1] International Labour Organization (2023)
**Title:** A Call for Safer and Healthier Working Environments  
**Publisher:** ILO (International Labour Organization), Geneva, Switzerland  
**Year:** 2023  
**Link:** https://www.ilo.org/  
**Citation:**  
```
International Labour Organization, A Call for Safer and Healthier Working Environments. 
Geneva, Switzerland: ILO, 2023.
```
**Relevance:** Establishes the problem statement—3 million work-related deaths globally annually; construction and manufacturing account for a large share.

**Where to find:** https://www.ilo.org/global/topics/safety-and-health-at-work/

---

### [2] Nath, Behzadan, and Paal (2020)
**Title:** Deep learning for site safety: Real-time detection of personal protective equipment  
**Authors:** N. D. Nath, A. H. Behzadan, S. G. Paal  
**Journal:** Automation in Construction  
**Volume:** 112  
**Article Number:** 103085  
**Year:** 2020  
**DOI:** 10.1016/j.autcon.2020.103085  
**Citation:**  
```
N. D. Nath, A. H. Behzadan, and S. G. Paal, "Deep learning for site safety: Real-time 
detection of personal protective equipment," Automation in Construction, vol. 112, 
Art. no. 103085, 2020.
```
**Relevance:** Core PPE detection paper; demonstrates YOLOv3/v4 for helmet detection on construction sites with 90%+ accuracy.  
**Where to find:** https://www.sciencedirect.com/journal/automation-in-construction

---

### [3] Wang, Wu, Yang, Thirunavukarasu, Evison, and Zhao (2021)
**Title:** Fast personal protective equipment detection for real construction sites using deep learning approaches  
**Authors:** Z. Wang, Y. Wu, L. Yang, A. Thirunavukarasu, C. Evison, Y. Zhao  
**Journal:** Sensors  
**Volume:** 21  
**Issue:** 10  
**Article Number:** 3478  
**Year:** 2021  
**DOI:** 10.3390/s21103478  
**Citation:**  
```
Z. Wang, Y. Wu, L. Yang, A. Thirunavukarasu, C. Evison, and Y. Zhao, "Fast personal 
protective equipment detection for real construction sites using deep learning approaches," 
Sensors, vol. 21, no. 10, Art. no. 3478, 2021.
```
**Relevance:** Compares multiple detection architectures (Faster R-CNN, YOLOv3, YOLOv4); recommends YOLOv4 for real construction sites.  
**Where to find:** https://www.mdpi.com/journal/sensors

---

### [4] Redmon, Divvala, Girshick, and Farhadi (2016)
**Title:** You only look once: Unified, real-time object detection  
**Authors:** J. Redmon, S. Divvala, R. Girshick, A. Farhadi  
**Conference:** IEEE Conference on Computer Vision and Pattern Recognition (CVPR)  
**Year:** 2016  
**Pages:** 779–788  
**DOI:** 10.1109/CVPR.2016.91  
**Citation:**  
```
J. Redmon, S. Divvala, R. Girshick, and A. Farhadi, "You only look once: Unified, 
real-time object detection," in Proc. IEEE Conf. Comput. Vis. Pattern Recognit. (CVPR), 
2016, pp. 779-788.
```
**Relevance:** Foundational YOLO algorithm; enables real-time single-stage object detection used in all modern systems.  
**Where to find:** https://arxiv.org/abs/1506.02640 (Open access preprint)

---

### [5] Jocher, Chaurasia, and Qiu (2023)
**Title:** Ultralytics YOLOv8  
**Authors:** G. Jocher, A. Chaurasia, J. Qiu  
**URL:** https://github.com/ultralytics/ultralytics  
**Year:** 2023  
**Citation:**  
```
G. Jocher, A. Chaurasia, and J. Qiu, Ultralytics YOLOv8, 2023. 
[Online]. Available: https://github.com/ultralytics/ultralytics
```
**Relevance:** Latest YOLO version; we use YOLOv8n (nano) for IntelliSafe edge deployment.  
**Where to find:** https://github.com/ultralytics/ultralytics (Open source)

---

### [6] NVIDIA Corporation
**Title:** Jetson Nano Developer Kit  
**Publisher:** NVIDIA  
**URL:** https://developer.nvidia.com/embedded/jetson-nano  
**Citation:**  
```
NVIDIA Corporation, Jetson Nano Developer Kit. 
[Online]. Available: https://developer.nvidia.com/embedded/jetson-nano
```
**Relevance:** Hardware platform for edge deployment; enables real-time inference on low-power, low-cost device ($100).  
**Where to find:** https://developer.nvidia.com/embedded/jetson-nano (Official documentation)

---

### [7] de Venâncio, Lisboa, and Barbosa (2022)
**Title:** An automatic fire detection system based on deep convolutional neural networks for low-power, resource-constrained devices  
**Authors:** P. V. A. B. de Venâncio, A. C. Lisboa, A. V. Barbosa  
**Journal:** Neural Computing and Applications  
**Volume:** 34  
**Pages:** 15349–15368  
**Year:** 2022  
**DOI:** 10.1007/s00521-022-07467-z  
**Citation:**  
```
P. V. A. B. de Venâncio, A. C. Lisboa, and A. V. Barbosa, "An automatic fire detection 
system based on deep convolutional neural networks for low-power, resource-constrained devices," 
Neural Computing and Applications, vol. 34, pp. 15349-15368, 2022.
```
**Relevance:** Demonstrates fire/smoke detection on edge hardware (Jetson, Raspberry Pi); validates low-power CNN deployment.  
**Where to find:** https://link.springer.com/article/10.1007/s00521-022-07467-z (Springer; may require subscription)

---

### [8] OASIS
**Title:** MQTT Version 5.0  
**Standard:** OASIS Standard  
**Year:** March 2019  
**URL:** https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html  
**Citation:**  
```
OASIS, MQTT Version 5.0, OASIS Standard, Mar. 2019. 
[Online]. Available: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html
```
**Relevance:** Industry-standard messaging protocol; forms the transport layer in IntelliSafe (Mosquitto broker, paho-mqtt library).  
**Where to find:** https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html (Open access)

---

## How to Access These References

### Open Access / Free
- **[4]** Redmon et al. YOLO: https://arxiv.org/abs/1506.02640
- **[5]** YOLOv8: https://github.com/ultralytics/ultralytics (GitHub, fully open source)
- **[6]** Jetson Nano: https://developer.nvidia.com/embedded/jetson-nano (Official docs)
- **[8]** MQTT 5.0: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html

### Journal / Subscription Access
- **[2]** Nath et al.: Check COMSATS library access or ResearchGate
- **[3]** Wang et al.: https://www.mdpi.com/journal/sensors (Open access journal)
- **[7]** de Venâncio et al.: https://link.springer.com/article/10.1007/s00521-022-07467-z

### Organization
- **[1]** ILO: https://www.ilo.org/ (Official organization site)

---

## Recommended Citation Format for Your Report

Use **IEEE format** (standard for engineering):

```
[1] International Labour Organization, A Call for Safer and Healthier Working Environments. 
    Geneva, Switzerland: ILO, 2023.
[2] N. D. Nath, A. H. Behzadan, and S. G. Paal, "Deep learning for site safety: Real-time 
    detection of personal protective equipment," Automation in Construction, vol. 112, 
    Art. no. 103085, 2020.
[3] Z. Wang, Y. Wu, L. Yang, A. Thirunavukarasu, C. Evison, and Y. Zhao, "Fast personal 
    protective equipment detection for real construction sites using deep learning approaches," 
    Sensors, vol. 21, no. 10, Art. no. 3478, 2021.
[4] J. Redmon, S. Divvala, R. Girshick, and A. Farhadi, "You only look once: Unified, 
    real-time object detection," in Proc. IEEE Conf. Comput. Vis. Pattern Recognit. (CVPR), 
    2016, pp. 779-788.
[5] G. Jocher, A. Chaurasia, and J. Qiu, Ultralytics YOLOv8, 2023. [Online]. 
    Available: https://github.com/ultralytics/ultralytics
[6] NVIDIA Corporation, Jetson Nano Developer Kit. [Online]. Available: 
    https://developer.nvidia.com/embedded/jetson-nano
[7] P. V. A. B. de Venâncio, A. C. Lisboa, and A. V. Barbosa, "An automatic fire detection 
    system based on deep convolutional neural networks for low-power, resource-constrained devices," 
    Neural Computing and Applications, vol. 34, pp. 15349-15368, 2022.
[8] OASIS, MQTT Version 5.0, OASIS Standard, Mar. 2019. [Online]. Available: 
    https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html
```

---

## Next Steps

1. **Download PDFs** from the links above and save to a `references/` subfolder (optional)
2. **Use in your FYP Report** — copy the IEEE format section above into your report's References section
3. **Link in Presentations** — cite these when defending your work
4. **Keep Updated** — if you add new references, update this file

---

**Version:** 1.0  
**Last updated:** Oct 7, 2026  
**Status:** Ready for FYP Report
