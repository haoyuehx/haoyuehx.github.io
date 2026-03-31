---
title: "启动流程：从 Reset Vector 到 Linux 内核"
date: 2026-03-31
lastmod: 2025-03-31
garden_tags: ["操作系统","Boot","BIOS"]
draft: false
summary: "boot 启动流程源码笔记"
status: "seeding"
---

# 启动流程

启动链路可抽象为控制权在不同阶段的转移过程。当前主线为 `UEFI + GPT + ESP`，`BIOS + MBR` 作为兼容路径保留。

```text
Power On
  -> CPU 从复位向量开始执行
  -> 固件完成最小硬件初始化
  -> 固件加载引导程序（.efi 或 legacy boot sector）
  -> 引导程序加载内核镜像
  -> 内核接管（ExitBootServices 之后）
```

---

## MIPS 早期启动特征

MIPS 早期阶段的核心目标是确定性执行。由于 cache/TLB/MMU 可能尚未稳定，代码通常优先使用行为可预测的地址区。

| 区域 | 常见用途 | 早期阶段适用性 |
|---|---|---|
| `kuseg` | 用户态虚拟地址 | 低，依赖 MMU |
| `kseg0` | cached 直映 | 中，依赖 cache 状态 |
| `kseg1` | uncached 直映 | 高，常用于寄存器/串口 |
| `kseg2/3` | 内核映射区 | 低，依赖完整映射 |

典型 MIPS 启动主干：

```text
start.S(reset)
  -> 关中断/初始化 CP0
  -> 早期时钟与平台初始化
  -> 设置栈指针 sp
  -> 跳转 C 入口 board_init_f
  -> relocate_code
  -> board_init_r
  -> bootm/booti/bootz
```

`sp` 在进入 C 前必须可用；否则函数调用现场无法可靠保存。

---

## 源码主线（正文中段）

以下代码块为结构化摘录，用于对应常见开源实现中的调用关系。

### U-Boot(MIPS): `start.S -> board_init_f -> board_init_r`

路径参考：`arch/mips/cpu/start.S`、`common/board_f.c`、`common/board_r.c`

```asm
/* 结构化摘录 */
reset:
    mtc0  zero, CP0_STATUS
    # early cpu/clock init
    la    sp, CONFIG_SYS_INIT_SP_ADDR
    jal   board_init_f
    nop
```

```c
/* 结构化摘录 */
void board_init_f(ulong boot_flags) {
    early_init_uart_clock_dram();
    relocate_code(...);
}

void board_init_r(gd_t *gd, ulong dest_addr) {
    init_drivers_and_commands();
    run_main_loop();
}
```

### SeaBIOS: 启动设备选择与移交

路径参考：`src/post.c`、`src/boot.c`

```c
/* 结构化摘录 */
void boot_prep(void) {
    scan_bootorder();
    select_boot_device();
    call_boot_entry();
}
```

### EDK2/UEFI: Boot Manager 调度

路径参考：`MdeModulePkg/Universal/BdsDxe/`

```c
/* 结构化摘录 */
EfiBootManagerRefreshAllBootOption();
Option = EfiBootManagerGetBootManagerMenu();
EfiBootManagerBoot(&Option);   // 内部进入 LoadImage/StartImage
```

固件阶段向内核阶段的关键分界点为 `ExitBootServices()`。

### GRUB(UEFI): EFI 应用入口

路径参考：`grub-core/kern/efi/`

```c
/* 结构化摘录 */
grub_efi_image_handle = image_handle;
grub_machine_init();
grub_main();
```

在 UEFI 模式下，GRUB 作为 EFI 应用被固件直接加载，不再依赖 MBR 446B 引导代码链。

---

## BIOS+MBR 与 UEFI+GPT

### BIOS + MBR（兼容路径）

BIOS 完成 POST 后读取 LBA0 的 MBR 并移交执行。MBR 结构如下：

| 区段 | 大小 |
|---|---|
| boot code | 446B |
| partition table | 64B |
| signature | 2B (`0x55AA`) |

该路径可用，但扩展与安全能力受限。

### UEFI + GPT + ESP（当前主线）

UEFI 从 ESP 加载 `.efi` 启动程序，主流程如下：

```text
SEC/PEI/DXE/BDS
  -> 读取 NVRAM 启动项（BootOrder/Boot####）
  -> 从 ESP 加载 *.efi
  -> 引导器加载内核
  -> ExitBootServices
  -> Kernel
```

常见 ESP 路径：

- `EFI/BOOT/BOOTX64.EFI`
- `EFI/ubuntu/grubx64.efi`
- `EFI/systemd/systemd-bootx64.efi`
- `EFI/Microsoft/Boot/bootmgfw.efi`

---

## 快速源码索引

| 主题 | 入口 |
|---|---|
| U-Boot MIPS 汇编入口 | `arch/mips/cpu/start.S` |
| U-Boot C 初始化 | `common/board_f.c`, `common/board_r.c` |
| SeaBIOS 启动调度 | `src/post.c`, `src/boot.c` |
| EDK2 BDS | `MdeModulePkg/Universal/BdsDxe/` |
| EDK2 变量服务 | `MdeModulePkg/Universal/Variable/` |
| GRUB BIOS 平台 | `grub-core/boot/i386/pc/` |
| GRUB UEFI 平台 | `grub-core/kern/efi/` |

结论：默认启动链路应按 `UEFI + GPT + ESP` 组织叙述；`BIOS + MBR` 作为兼容分支理解与排障使用。
