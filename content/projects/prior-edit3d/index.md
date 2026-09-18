---
title: "PriorEdit3D"
date: 2026-09-04
lastmod: 2026-09-18
draft: false
project_tags: ["3D Editing", "Generative AI", "Computer Vision"]
status: "evergreen"
weight: 7
summary: "无需成对 3D 监督的前馈式 3D 编辑框架，通过生成先验蒸馏统一视觉、语义与几何约束。"
links:
    project:
        text: "Project Page"
        icon: "fas fa-globe"
        href: "https://thiamine128.github.io/PriorEdit3D/"
        weight: 1
    paper:
        text: "Paper"
        icon: "fas fa-file-lines"
        href: "https://arxiv.org/abs/2609.04942"
        weight: 2
    code:
        text: "Code"
        icon: "fab fa-github"
        href: "https://github.com/thiamine128/PriorEdit3D"
        weight: 3
    researchgate:
        text: "ResearchGate"
        icon: "fab fa-researchgate"
        href: "https://www.researchgate.net/publication/414038908_Learning_3D_Editing_without_Paired_Supervision_via_Generative_Prior_Distillation"
        weight: 4
---

**Learning 3D Editing without Paired Supervision via Generative Prior Distillation**  
Hao Wen, Weibin Yun, Hongxing Fan, Haotian Lu, Rui Chen, Zehuan Huang, Lu Sheng  
*SIGGRAPH Asia 2026 Conference Papers*

![PriorEdit3D 支持局部与全局的指令驱动 3D 编辑](featured.png)

## 项目简介

高质量的成对 3D 编辑数据很难获得。已有方法通常依赖逐场景的测试时优化，推理速度较慢；或者先构造伪 3D 编辑对再进行监督训练，容易将结构漂移、几何畸变和生成伪影带入模型。

我们提出 **PriorEdit3D**：一个无需成对 3D 监督、无需测试时反演和手工 3D mask 的前馈式 3D 编辑框架。核心思想是 **Generative Prior Distillation**——不直接学习目标 3D 资产，而是将基础模型中的视觉、语义和几何知识蒸馏到原生 3D 编辑模型中。

给定源 3D 资产和自然语言编辑指令，模型能够完成部件添加、删除、替换和颜色修改，也支持姿态、纹理与整体风格等全局编辑。单次编辑在一张 A100 GPU 上约需 **7 秒**。

## 方法

![PriorEdit3D 的训练框架](method-overview.png)

PriorEdit3D 建立在 UniLat3D 的统一 3D latent 空间之上，并通过可微渲染把多种基础模型提供的监督信号传回 3D 编辑器。三个互补的先验分别解决“编辑得像不像”“指令是否执行”“三维结构是否合理”三个问题。

### 2D 视觉先验

在主编辑视角上，2D 图像编辑模型根据源图像和指令生成目标图像。编辑后的 3D latent 经过可微渲染后，通过前景像素、轮廓透明度和感知特征损失与目标图像对齐。这为模型提供细粒度、稳定的局部编辑监督。

### VLM 语义先验

单视角像素监督无法保证背面和侧面的编辑质量。我们在新的观察视角渲染编辑结果，并使用冻结的 VLM 提供两类反馈：

- **Instruction Following**：新视角下的结果是否正确执行编辑指令；
- **Identity Preservation**：未编辑部分是否保持源物体的身份与结构。

梯度通过图像输入和可微渲染器回传，只更新 3D 编辑模型，从而改善跨视角的语义一致性。

### 3D 几何先验

仅靠 2D 投影仍可能产生几何坍塌、结构漂移或多视角不一致。为此，我们引入 3D-aware Distribution Matching Distillation（DMD），使用预训练 UniLat3D 作为冻结的 3D teacher，将编辑结果约束在真实 3D 资产的数据流形附近。

这一正则项既提供指向预训练 3D 先验的吸引力，也通过 fake model 估计学生分布，避免简单匹配 teacher 导致的过度收缩和模式坍塌。

## 数据构建

训练数据完全由 2D 编辑监督构成，不需要成对的源 3D 与目标 3D：

1. 从 **73,451** 个 Objaverse 资产渲染标准正视图；
2. 使用 Gemini 3 Flash 生成编辑指令；
3. 使用 Qwen-Image-Edit-2511-Lightning 生成对应的 2D 编辑结果；
4. 通过 Qwen3-VL 和 SSIM 过滤编辑失败、背景破坏、主体裁剪、语义不合理及无效编辑。

最终数据集包含 **73,121** 个高质量编辑样本和 **150,482** 个标注操作，覆盖局部的添加、删除、替换、形状与颜色修改，以及全局的姿态、纹理和风格变化。

## 实验结果

PriorEdit3D 在编辑图像对齐、整体 3D 质量、条件对齐和身份保持方面取得了具有竞争力的综合表现，并显著缩短了编辑时间。

| Method | PSNR ↑ | SSIM ↑ | FID ↓ | CLIP-T ↑ | LLM-Id ↑ | LLM-Inst ↑ | Runtime ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|
| 3DEditFormer | 18.89 | 0.89 | 167.85 | 0.28 | 86.31 | 53.39 | 74 s |
| VoxHammer | 16.87 | 0.87 | 179.22 | 0.27 | 76.54 | 51.74 | 133 s |
| Nano3D | 19.90 | 0.91 | 103.50 | 0.21 | 85.35 | 60.37 | 14 s |
| **PriorEdit3D** | **24.37** | **0.94** | **71.96** | **0.31** | **93.13** | **86.92** | **7 s** |

在 ABO 与 GSO 的分布外评测中，模型同样表现出较好的泛化能力。消融实验进一步表明三个监督信号相互补充：像素损失负责编辑视角的细节保真，VLM 强化新视角的语义一致性，DMD 则维持 3D 几何质量和跨视角稳定性。

## 局限性

当前方法仍不擅长精确文字、密集小物体等高频细节编辑，未编辑区域有时会发生轻微纹理或几何漂移。结果也会受到 2D 编辑 teacher 和 UniLat3D 先验能力的限制；大幅姿态或拓扑变化仍然具有挑战。

## Citation

```bibtex
@article{wen2026prioredit3d,
  title   = {Learning 3D Editing without Paired Supervision via Generative Prior Distillation},
  author  = {Wen, Hao and Yun, Weibin and Fan, Hongxing and Lu, Haotian and Chen, Rui and Huang, Zehuan and Sheng, Lu},
  journal = {ACM Transactions on Graphics},
  year    = {2026}
}
```
