---
title: "CS:APP Labs"
date: 2025-07-21
lastmod: 2025-07-21
draft: false
math: true
slug: "csapp-labs"
aliases: ["/projects/project6/"]
project_tags: ["CS:APP", "Computer Systems", "x86-64"]
status: "seeding"
summary: "Learning assembly, program execution, memory systems, and systems programming through hands-on labs."
weight: 6
---

## bomb lab
**Common x86-64 registers**
| Register | Purpose |
| ----------- | ---------------------------------- |
| `RAX` | Accumulator; often holds return values or arithmetic results. |
| `RBX` | Callee-saved general-purpose register. |
| `RCX` | Counter; often used in loops and string operations. |
| `RDX` | Data register; used for arguments and multiply/divide results. |
| `RSI` | Source address for string or memory operations. |
| `RDI` | Destination address; also the first function argument. |
| `RBP` | Frame pointer for accessing local variables. |
| `RSP` | Stack pointer for push/pop operations. |
| `RIP` | Instruction pointer. |
| `R8`\~`R15` | Additional general-purpose registers for arguments or temporary values. |

**Conditional jumps (based on flags)**
Flags:
- ZF: zero flag (set when values are equal).
- SF: sign flag (set for a negative result).
- OF: overflow flag (signed overflow).
- CF: carry flag (unsigned overflow).

| Instruction | Condition | Meaning |
| ------------- | ------------- | -------------------- |
| `jmp` | Always | Unconditional jump. |
| `je` / `jz` | ZF=1 | Equal / zero. |
| `jne` / `jnz` | ZF=0 | Not equal. |
| `jg` / `jnle` | ZF=0 and SF=OF | Signed greater than. |
| `jge` / `jnl` | SF=OF | Signed greater than or equal. |
| `jl` / `jnge` | SF≠OF | Signed less than. |
| `jle` / `jng` | ZF=1 or SF≠OF | Signed less than or equal. |
| `ja` | CF=0 and ZF=0 | Unsigned above. |
| `jae` / `jnb` | CF=0 | Unsigned above or equal. |
| `jb` / `jc` | CF=1 | Unsigned below. |
| `jbe` | CF=1 or ZF=1 | Unsigned below or equal. |



Use `objdump` to disassemble the ELF file.
```shell
objdump -d bomb > bomb.d
```

The symbols show six phases to solve.

To display assembly in GDB while debugging:
```shell
gdb ./your_program
(gdb) layout asm
```

Or disassemble a function:
```shell
disas phase_1
```

### phase_1
Set a GDB breakpoint at `phase_1`.
```shell
(gdb) b phase_1
Breakpoint 1 at 0x400ee0
```

Enter any string.

Step into the function.
```shell
(gdb) si
0x0000000000400ee4 in phase_1 ()
```
The assembly compares strings.
```nasm
=> 0x0000000000400ee4 <+4>:	    mov    $0x402400,%esi
   0x0000000000400ee9 <+9>:	    call   0x401338 <strings_not_equal>
   0x0000000000400eee <+14>:	test   %eax,%eax
   0x0000000000400ef0 <+16>:	je     0x400ef7 <phase_1+23>
 ```

The expected string for `phase_1` is at address `0x402400`; run:
```shell
(gdb) x/s 0x402400
0x402400:	"Border relations with Canada have never been better."
```
This gives the answer for `phase_1`.

### phase_2
Set a breakpoint at `phase_2`.
```nasm
   0x0000000000400efe <+2>:	    sub    $0x28,%rsp
   0x0000000000400f02 <+6>:	    mov    %rsp,%rsi
   0x0000000000400f05 <+9>:	    call   0x40145c <read_six_numbers>
   0x0000000000400f0a <+14>:	cmpl   $0x1,(%rsp)
   0x0000000000400f0e <+18>:	je     0x400f30 <phase_2+52>
   0x0000000000400f10 <+20>:	call   0x40143a <explode_bomb>
```
The function allocates `0x28` bytes on the stack and checks whether the first value is 1.

If the first input was not 1, use `set` to change the register value while debugging.
```shell
(gdb) set *(int *)($rsp) = 1
(gdb) i r rsp
rsp            0x7fffffffd978      0x7fffffffd978
(gdb) x $rsp
0x7fffffffd978:	"\001"
```
The loop checks whether each subsequent number is twice the previous one.

```nasm
   0x0000000000400f17 <+27>:	mov    -0x4(%rbx),%eax
   0x0000000000400f1a <+30>:	add    %eax,%eax
   0x0000000000400f1c <+32>:	cmp    %eax,(%rbx)
   0x0000000000400f1e <+34>:	je     0x400f25 <phase_2+41>
   0x0000000000400f20 <+36>:	call   0x40143a <explode_bomb>
   0x0000000000400f25 <+41>:	add    $0x4,%rbx
   0x0000000000400f29 <+45>:	cmp    %rbp,%rbx
   0x0000000000400f2c <+48>:	jne    0x400f17 <phase_2+27>
```
This gives the answer for `phase_2`.
### phase_3
Set a breakpoint at `phase_3`.

This section checks whether more than one number was entered.
```nasm
=> 0x0000000000400f43 <+0>:	    sub    $0x18,%rsp
   0x0000000000400f47 <+4>:	    lea    0xc(%rsp),%rcx
   0x0000000000400f4c <+9>:	    lea    0x8(%rsp),%rdx
   0x0000000000400f51 <+14>:	mov    $0x4025cf,%esi
   0x0000000000400f56 <+19>:	mov    $0x0,%eax
   0x0000000000400f5b <+24>:	call   0x400bf0 <__isoc99_sscanf@plt>
   0x0000000000400f60 <+29>:	cmp    $0x1,%eax
   0x0000000000400f63 <+32>:	jg     0x400f6a <phase_3+39>
   0x0000000000400f65 <+34>:	call   0x40143a <explode_bomb>
```
Next is a switch-like selection; the first value must be less than 7.
```nasm
=> 0x0000000000400f6a <+39>:	cmpl   $0x7,0x8(%rsp)
   0x0000000000400f6f <+44>:	ja     0x400fad <phase_3+106>
   0x0000000000400f71 <+46>:	mov    0x8(%rsp),%eax
   0x0000000000400f75 <+50>:	jmp    *0x402470(,%rax,8)
   0x0000000000400f7c <+57>:	mov    $0xcf,%eax
   0x0000000000400f81 <+62>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400f83 <+64>:	mov    $0x2c3,%eax
   0x0000000000400f88 <+69>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400f8a <+71>:	mov    $0x100,%eax
   0x0000000000400f8f <+76>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400f91 <+78>:	mov    $0x185,%eax
   0x0000000000400f96 <+83>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400f98 <+85>:	mov    $0xce,%eax
   0x0000000000400f9d <+90>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400f9f <+92>:	mov    $0x2aa,%eax
   0x0000000000400fa4 <+97>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400fa6 <+99>:	mov    $0x147,%eax
   0x0000000000400fab <+104>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400fad <+106>:	call   0x40143a <explode_bomb>
   0x0000000000400fb2 <+111>:	mov    $0x0,%eax
   0x0000000000400fb7 <+116>:	jmp    0x400fbe <phase_3+123>
   0x0000000000400fb9 <+118>:	mov    $0x137,%eax
```
Inspect memory at `0x402470` to see the jump targets for different inputs.
```shell
(gdb) x/8xg 0x402470
0x402470:	0x0000000000400f7c	0x0000000000400fb9
0x402480:	0x0000000000400f83	0x0000000000400f8a
0x402490:	0x0000000000400f91	0x0000000000400f98
0x4024a0:	0x0000000000400f9f	0x0000000000400fa6
```
This reveals all possible answers.
```
0 207  
1 311  
2 707  
3 256  
4 389  
5 206  
6 682  
7 327  
```
### phase_4
Set a breakpoint at `phase_4`.
As in `phase_3`, the opening section checks that two numbers were entered.
```nasm
   0x0000000000401051 <+69>:	cmpl   $0x0,0xc(%rsp)
   0x0000000000401056 <+74>:	je     0x40105d <phase_4+81>
   0x0000000000401058 <+76>:	call   0x40143a <explode_bomb>
```
The final section checks whether the second value is 0.
The middle calls `func4` and checks whether `$eax` is 0.
```shell
(gdb) disas func4
Dump of assembler code for function func4:
   0x0000000000400fce <+0>:	    sub    $0x8,%rsp
   0x0000000000400fd2 <+4>:	    mov    %edx,%eax
   0x0000000000400fd4 <+6>:	    sub    %esi,%eax
   0x0000000000400fd6 <+8>:	    mov    %eax,%ecx
   0x0000000000400fd8 <+10>:	shr    $0x1f,%ecx
   0x0000000000400fdb <+13>:	add    %ecx,%eax
   0x0000000000400fdd <+15>:	sar    $1,%eax
   0x0000000000400fdf <+17>:	lea    (%rax,%rsi,1),%ecx
   0x0000000000400fe2 <+20>:	cmp    %edi,%ecx
   0x0000000000400fe4 <+22>:	jle    0x400ff2 <func4+36>
   0x0000000000400fe6 <+24>:	lea    -0x1(%rcx),%edx
   0x0000000000400fe9 <+27>:	call   0x400fce <func4>
   0x0000000000400fee <+32>:	add    %eax,%eax
   0x0000000000400ff0 <+34>:	jmp    0x401007 <func4+57>
   0x0000000000400ff2 <+36>:	mov    $0x0,%eax
   0x0000000000400ff7 <+41>:	cmp    %edi,%ecx
   0x0000000000400ff9 <+43>:	jge    0x401007 <func4+57>
   0x0000000000400ffb <+45>:	lea    0x1(%rcx),%esi
   0x0000000000400ffe <+48>:	call   0x400fce <func4>
   0x0000000000401003 <+53>:	lea    0x1(%rax,%rax,1),%eax
   0x0000000000401007 <+57>:	add    $0x8,%rsp
   0x000000000040100b <+61>:	ret
End of assembler dump.
```
This is a path-encoding variant of binary search. For `func4` to return 0, recursion must proceed left from the root until `target == mid`.

Thus, values of $2^m-1$ below 14 work.
This gives the answer for `phase_4`.
```
0 0  
1 0  
3 0
7 0 
```

### phase_5
Set a breakpoint at `phase_5`.

The code first checks whether the input length is 6.
```nasm
=> 0x000000000040107a <+24>:	call   0x40131b <string_length>
   0x000000000040107f <+29>:	cmp    $0x6,%eax
   0x0000000000401082 <+32>:	je     0x4010d2 <phase_5+112>
   0x0000000000401084 <+34>:	call   0x40143a <explode_bomb>
```
A later instruction compares two strings.
```nasm
   0x00000000004010b3 <+81>:	mov    $0x40245e,%esi
   0x00000000004010b8 <+86>:	lea    0x10(%rsp),%rdi
   0x00000000004010bd <+91>:	call   0x401338 <strings_not_equal>
```
Print the comparison string.
```shell
(gdb) x/s 0x40245e
0x40245e:	"flyers"
```
The middle section transforms each character `str[i]`:
`str[i] & 0xf` takes the low four bits as an index into the table at `0x4024b0`.
The substituted character is written to the stack.
The resulting string must equal `"flyers"` or the bomb explodes.

```nasm
=> 0x000000000040108b <+41>:	movzbl (%rbx,%rax,1),%ecx
   0x000000000040108f <+45>:	mov    %cl,(%rsp)
   0x0000000000401092 <+48>:	mov    (%rsp),%rdx
   0x0000000000401096 <+52>:	and    $0xf,%edx
   0x0000000000401099 <+55>:	movzbl 0x4024b0(%rdx),%edx
   0x00000000004010a0 <+62>:	mov    %dl,0x10(%rsp,%rax,1)
   0x00000000004010a4 <+66>:	add    $0x1,%rax
   0x00000000004010a8 <+70>:	cmp    $0x6,%rax
   0x00000000004010ac <+74>:	jne    0x40108b <phase_5+41>
```

Print the data around `0x4024b0`.
```shell
(gdb) x/s 0x4024b0
0x4024b0 <array.3449>:	"maduiersnfotvbylSo you think you can stop the bomb with ctrl-c, do you?"
```
Work backward:
```
Target:  f  l  y  e  r  s
Index:   0  1  2  3  4  5
        |  |  |  |  |  |
table:  m  a  d  u  i  e  r  s  n  f  o  t  v  b  y  l
index:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
               ↑           ↑     ↑     ↑     ↑     ↑
             'f'=9  'l'=15 'y'=14 'e'=5 'r'=6 's'=7
```
Find six characters `c[0..5]` such that:

```
c[0] & 0xf == 9   → (e.g. 'I', 'Y', 'i', 'y')
c[1] & 0xf == 15  → (e.g. 'O', 'o')
c[2] & 0xf == 14  → (e.g. 'N', 'n', '~')
c[3] & 0xf == 5   → (e.g. 'E', 'e', 'U', 'u')
c[4] & 0xf == 6   → (e.g. 'F', 'f', 'V', 'v')
c[5] & 0xf == 7   → (e.g. 'G', 'g', 'W', 'w')
```
A suitable combination gives the answer for `phase_5`.

### phase_6
Set a breakpoint at `phase_6`.

Read six integers.
```nasm
=> 0x0000000000401106 <+18>:	call   0x40145c <read_six_numbers>
```

Nested loops:

First check whether each number is between 1 and 6.
```nasm
=> 0x0000000000401117 <+35>:	mov    0x0(%r13),%eax
   0x000000000040111b <+39>:	sub    $0x1,%eax
   0x000000000040111e <+42>:	cmp    $0x5,%eax
   0x0000000000401121 <+45>:	jbe    0x401128 <phase_6+52>
   0x0000000000401123 <+47>:	call   0x40143a <explode_bomb>
```
The inner loop checks uniqueness; all six numbers must differ.
```nasm
=> 0x0000000000401135 <+65>:	movslq %ebx,%rax
   0x0000000000401138 <+68>:	mov    (%rsp,%rax,4),%eax
   0x000000000040113b <+71>:	cmp    %eax,0x0(%rbp)
   0x000000000040113e <+74>:	jne    0x401145 <phase_6+81>
   0x0000000000401140 <+76>:	call   0x40143a <explode_bomb>
   0x0000000000401145 <+81>:	add    $0x1,%ebx
   0x0000000000401148 <+84>:	cmp    $0x5,%ebx
   0x000000000040114b <+87>:	jle    0x401135 <phase_6+65>
```

Transform each number `x` into `7 - x`.
```nasm
=> 0x000000000040115b <+103>:	mov    $0x7,%ecx
   0x0000000000401160 <+108>:	mov    %ecx,%edx
   0x0000000000401162 <+110>:	sub    (%rax),%edx
   0x0000000000401164 <+112>:	mov    %edx,(%rax)
   0x0000000000401166 <+114>:	add    $0x4,%rax
   0x000000000040116a <+118>:	cmp    %rsi,%rax
   0x000000000040116d <+121>:	jne    0x401160 <phase_6+108>
```

Analysis:

`mov 0x8(%rdx),%rdx` is a typical `ptr = ptr->next` operation.

The eight-byte offset equals one pointer-sized field on a 64-bit system.
```nasm
=> 0x000000000040116f <+123>:	mov    $0x0,%esi
   0x0000000000401174 <+128>:	jmp    0x401197 <phase_6+163>
   0x0000000000401176 <+130>:	mov    0x8(%rdx),%rdx
   0x000000000040117a <+134>:	add    $0x1,%eax
   0x000000000040117d <+137>:	cmp    %ecx,%eax
   0x000000000040117f <+139>:	jne    0x401176 <phase_6+130>
```
Memory confirms the node layout: four bytes for `idx`, four for the value, and eight for the `next` pointer.

```shell
(gdb) x/2gx 0x6032d0
0x6032d0 <node1>:	0x000000010000014c	0x00000000006032e0
(gdb) x/2gx 0x6032e0
0x6032e0 <node2>:	0x00000002000000a8	0x00000000006032f0
(gdb) x/2gx 0x6032f0
0x6032f0 <node3>:	0x000000030000039c	0x0000000000603300
(gdb) x/2gx 0x603300
0x603300 <node4>:	0x00000004000002b3	0x0000000000603310
(gdb) x/2gx 0x603310
0x603310 <node5>:	0x00000005000001dd	0x0000000000603320
(gdb) x/2gx 0x603320
0x603320 <node6>:	0x00000006000001bb	0x0000000000000000
```

The loop finds each node pointer and stores it on the stack.
```nasm
=> 0x0000000000401181 <+141>:	jmp    0x401188 <phase_6+148>
   0x0000000000401183 <+143>:	mov    $0x6032d0,%edx
   0x0000000000401188 <+148>:	mov    %rdx,0x20(%rsp,%rsi,2)
   0x000000000040118d <+153>:	add    $0x4,%rsi
   0x0000000000401191 <+157>:	cmp    $0x18,%rsi
   0x0000000000401195 <+161>:	je     0x4011ab <phase_6+183>
   0x0000000000401197 <+163>:	mov    (%rsp,%rsi,1),%ecx
   0x000000000040119a <+166>:	cmp    $0x1,%ecx
   0x000000000040119d <+169>:	jle    0x401183 <phase_6+143>
   0x000000000040119f <+171>:	mov    $0x1,%eax
   0x00000000004011a4 <+176>:	mov    $0x6032d0,%edx
   0x00000000004011a9 <+181>:	jmp    0x401176 <phase_6+130>
```

The storage locations are visible here.
```shell
(gdb) x/6x 0x20+$rsp
0x7fffffffd810:	0x00000000006032f0	0x0000000000603300
0x7fffffffd820:	0x0000000000603310	0x0000000000603320
0x7fffffffd830:	0x00000000006032d0	0x00000000006032e0
```
Reconnect the six nodes in input order to form a new linked list.

```nasm
=> 0x00000000004011ab <+183>:	mov    0x20(%rsp),%rbx
   0x00000000004011b0 <+188>:	lea    0x28(%rsp),%rax
   0x00000000004011b5 <+193>:	lea    0x50(%rsp),%rsi
   0x00000000004011ba <+198>:	mov    %rbx,%rcx

   0x00000000004011bd <+201>:	mov    (%rax),%rdx
   0x00000000004011c0 <+204>:	mov    %rdx,0x8(%rcx)
   0x00000000004011c4 <+208>:	add    $0x8,%rax
   0x00000000004011c8 <+212>:	cmp    %rsi,%rax
   0x00000000004011cb <+215>:	je     0x4011d2 <phase_6+222>
   0x00000000004011cd <+217>:	mov    %rdx,%rcx
   0x00000000004011d0 <+220>:	jmp    0x4011bd <phase_6+201>
```
Verify descending order.

```nasm
=> 0x00000000004011d2 <+222>:	movq   $0x0,0x8(%rdx)
   0x00000000004011da <+230>:	mov    $0x5,%ebp
   0x00000000004011df <+235>:	mov    0x8(%rbx),%rax
   0x00000000004011e3 <+239>:	mov    (%rax),%eax
   0x00000000004011e5 <+241>:	cmp    %eax,(%rbx)
   0x00000000004011e7 <+243>:	jge    0x4011ee <phase_6+250>
   0x00000000004011e9 <+245>:	call   0x40143a <explode_bomb>
   0x00000000004011ee <+250>:	mov    0x8(%rbx),%rbx
   0x00000000004011f2 <+254>:	sub    $0x1,%ebp
   0x00000000004011f5 <+257>:	jne    0x4011df <phase_6+235>
```
This gives the answer for `phase_6`.

## archlab

## part B


### part C
Part C takes place in `sim/pipe`. PIPE is a pipelined Y86-64 processor with forwarding. Compared with Part B, it adds pipeline registers and control logic.

This part optimizes the program by changing `pipe-full.hcl` and `ncopy.ys`. Performance is measured in cycles per element (CPE).

First add the `iaddq` instruction to `pipe-full.hcl`, following the approach from Part B.

Test the simulator after the change. Update the Makefile as in Part B, build, and run the following tests:

```shell
$ ./psim -t ../y86-code/asumi.yo
$ cd ../ptest; make SIM=../pipe/psim
$ cd ../ptest; make SIM=../pipe/psim TFLAGS=-i
```

When all tests succeed, proceed to optimize `ncopy.ys`.

```C
/* 
 * ncopy - copy src to dst, returning number of positive ints
 * contained in src array.
 */
word_t ncopy(word_t *src, word_t *dst, word_t len) {
	word_t count = 0;
    word_t val;
    while (len > 0) {
		val = *src++;
        *dst = val;
        if (val > 0) 
            count++;
        len--;
    }
    return count;    
}
```

Test the initial implementation.
```shell
$ ./correctness.pl -p     # check correctness
$ ./benchmark.pl        # measure performance; a higher score is better
```
The result shows:

```shell
68/68 pass correctness test
Average CPE     15.18
Score   0.0/60.0
```

The initial CPE is `15.18`.

First, replace the `addq` instructions with `iaddq`.

Updated code:
```nasm
# You can modify this portion
	# Loop header
	xorq %rax,%rax		# count = 0;
	andq %rdx,%rdx		# len <= 0?
	jle Done		# if so, goto Done:

Loop:	
    mrmovq (%rdi), %r10	# read val from src...
	rmmovq %r10, (%rsi)	# ...and store it to dst
	andq %r10, %r10		# val <= 0?
	jle Npos		# if so, goto Npos:
	iaddq $1, %rax		# count++
Npos:
    iaddq $-1, %rdx     # len--
	iaddq $8, %rdi		# src++
	iaddq $8, %rsi		# dst++
	andq %rdx,%rdx		# len > 0?
	jg Loop			# if so, goto Loop:
```

Measure CPE again.

```shell
68/68 pass correctness test
Average CPE     12.70
Score   0.0/60.0
```

Next, use loop unrolling to process more elements per iteration and reduce loop overhead (see the loop-unrolling section of Chapter 5).

Implement 2×1 loop unrolling:

```nasm
ncopy:
	xorq %rax, %rax
	iaddq $-2, %rdx			# len - 2 >= 0?
	jl Rem
Loop:
	mrmovq (%rdi), %r8		# get *src
	mrmovq 8(%rdi), %r9		# get *(src + 1)
	rmmovq %r8, (%rsi)		# set *dst
	rmmovq %r9, 8(%rsi)		# set *(dst + 1)
	andq %r8, %r8			# val > 0?
	jle LNP8
	iaddq $1, %rax			# count++
LNP8:
	andq %r9, %r9			# val > 0?
	jle LNP9
	iaddq $1, %rax			# count++
LNP9:
	iaddq $16, %rdi			# src += 2
	iaddq $16, %rsi			# dst += 2
	iaddq $-2, %rdx			# len -= 2
	jge Loop

Rem:
	iaddq $2, %rdx
	jle Done

	mrmovq (%rdi), %r8
	rmmovq %r8, (%rsi)
	andq %r8, %r8
	jle Done
	iaddq $1, %rax
```
Measure CPE again.

```shell
68/68 pass correctness test
Average CPE     8.82
Score   33.5/60.0
```

Further optimization uses more registers to unroll the loop. Y86-64 has only 15 registers; after excluding those already used and the stack pointer, 10 remain. This allows up to 10×1 unrolling.

```nasm
ncopy:
	iaddq $-10, %rdx      # subtract 10 to check for a full block
	jl Rem                # fewer than 10 elements: handle the remainder

# Main loop: process 10 elements per iteration
Loop:
	# Load source data in eight-byte increments
	mrmovq (%rdi), %r8
	mrmovq 8(%rdi), %r9
	mrmovq 16(%rdi), %r10
	mrmovq 24(%rdi), %r11
	mrmovq 32(%rdi), %r12
	mrmovq 40(%rdi), %r13
	mrmovq 48(%rdi), %r14
	mrmovq 56(%rdi), %rcx
	mrmovq 64(%rdi), %rbx
	mrmovq 72(%rdi), %rbp

	# Store at the destination
	rmmovq %r8, (%rsi)
	rmmovq %r9, 8(%rsi)
	rmmovq %r10, 16(%rsi)
	rmmovq %r11, 24(%rsi)
	rmmovq %r12, 32(%rsi)
	rmmovq %r13, 40(%rsi)
	rmmovq %r14, 48(%rsi)
	rmmovq %rcx, 56(%rsi)
	rmmovq %rbx, 64(%rsi)
	rmmovq %rbp, 72(%rsi)

	# Count positive values in %rax
	andq %r8, %r8
	jle R10N8
	iaddq $1, %rax
R10N8:
	andq %r9, %r9
	jle R10N9
	iaddq $1, %rax
R10N9:
	andq %r10, %r10
	jle R10N10
	iaddq $1, %rax
R10N10:
	andq %r11, %r11
	jle R10N11
	iaddq $1, %rax
R10N11:
	andq %r12, %r12
	jle R10N12
	iaddq $1, %rax
R10N12:
	andq %r13, %r13
	jle R10N13
	iaddq $1, %rax
R10N13:
	andq %r14, %r14
	jle R10N14
	iaddq $1, %rax
R10N14:
	andq %rcx, %rcx
	jle R10N15
	iaddq $1, %rax
R10N15:
	andq %rbx, %rbx
	jle R10N16
	iaddq $1, %rax
R10N16:
	andq %rbp, %rbp
	jle R10N17
	iaddq $1, %rax
R10N17:
	# Update source, destination, and remaining length
	iaddq $80, %rdi       # 10 elements × 8 bytes = 80 bytes
	iaddq $80, %rsi
	iaddq $-10, %rdx
	jge Loop              # continue if at least 10 elements remain

# Handle fewer than 10 remaining elements
Rem:
	iaddq $10, %rdx       # restore the earlier subtraction
	jle Done              # finish if none remain

	# Dispatch by the number of remaining elements
	iaddq $-4, %rdx
	jge GE4               # four or more: go to GE4
	iaddq $2, %rdx
	jl R1                 # one element
	je R2                 # two elements
	jmp R3                # three elements

# Handle four to nine elements
GE4:
	je R4                 # four elements
	iaddq $-2, %rdx
	jl R5                 # five elements
	je R6                 # six elements

	iaddq $-2, %rdx
	jl R7                 # seven elements
	je R8                 # eight elements

# Nine elements require all R1–R9 operations.
# Fall through to R9.

R9:
	mrmovq 64(%rdi), %r8
	rmmovq %r8, 64(%rsi)
	andq %r8, %r8
	jle R8
	iaddq $1, %rax
R8:
	mrmovq 56(%rdi), %r8
	rmmovq %r8, 56(%rsi)
	andq %r8, %r8
	jle R7
	iaddq $1, %rax
R7:
	mrmovq 48(%rdi), %r8
	rmmovq %r8, 48(%rsi)
	andq %r8, %r8
	jle R6
	iaddq $1, %rax
R6:
	mrmovq 40(%rdi), %r8
	rmmovq %r8, 40(%rsi)
	andq %r8, %r8
	jle R5
	iaddq $1, %rax
R5:
	mrmovq 32(%rdi), %r8
	rmmovq %r8, 32(%rsi)
	andq %r8, %r8
	jle R4
	iaddq $1, %rax
R4:
	mrmovq 24(%rdi), %r8
	rmmovq %r8, 24(%rsi)
	andq %r8, %r8
	jle R3
	iaddq $1, %rax
R3:
	mrmovq 16(%rdi), %r8
	rmmovq %r8, 16(%rsi)
	andq %r8, %r8
	jle R2
	iaddq $1, %rax
R2:
	mrmovq 8(%rdi), %r8
	rmmovq %r8, 8(%rsi)
	andq %r8, %r8
	jle R1
	iaddq $1, %rax
R1:
	mrmovq (%rdi), %r8
	rmmovq %r8, (%rsi)
	andq %r8, %r8
	jle Done
	iaddq $1, %rax

Done:
	# Function exit (usually handled by ret in the main program)
```

Measure CPE again; the improvement is substantial.

```shell
68/68 pass correctness test
Average CPE     7.94
Score   51.2/60.0
```

Two further optimizations are possible:

1. In each case, `mrmovq` and `rmmovq` have a data dependency.
2. Remainder zero has a special case. If remainders are equally likely, that branch is usually not taken and increases CPE. Include zero in the remainder-search decision tree instead.

For the first optimization, note that `mrmovq` and `rmmovq` do not set condition codes. Insert them between `andq %r8, %r8` and `jle` to avoid a one-cycle pipeline stall. Delay the sign check for the previous value until the current block:
```nasm
Rn:
	andq %r8, %r8				# %r8=src[n - 1]
	mrmovq 8n(%rdi), %r8		# load src[n] into %r8
	jle EnNP
	iaddq $1, %rax
EnNP:
	rmmovq %r8, 8n(%rsi)		# set dst[n] = %r8
```

For the second optimization, choose the decision-tree split points carefully. Dynamic programming can minimize the instruction count:
```C++
#include<bits/stdc++.h>
using namespace std;
#define mp make_pair
#define rep(i,l,r) for(int i=(l);i<(r);++i)
#define per(i,l,r) for(int i=(r)-1;i>=(l);--i)
#define dd(x) cout << #x << " = " << x << ", "
#define de(x) cout << #x << " = " << x << endl
//-------

map<pair<int,int>, int> dp;

int dfs(pair<int, int> ij) {
	if (ij.first >= ij.second) return 0;
	if (dp.count(ij)) return dp[ij];
	int l, r;
	tie(l, r) = ij;
	pair<int, int> ret(INT_MAX, INT_MAX);
	rep(m, l, r + 1) {
		int sum = 1 + 1;	// test; je
		if (l <= m - 1) 	// jl: left branch
			sum += (l < m - 1) + (m - l) + dfs(mp(l, m - 1));
		if (m + 1 <= r)		// jg: right branch
			sum += (m + 1 < r) + (r - m) + dfs(mp(m + 1, r));
		ret = min(ret, mp(sum, m));
	}
	dd(l), dd(r), dd(ret.first), de(ret.second);
	return dp[ij] = ret.first;
}

int main() {
	int l, r; cin >> l >> r;
	dd(l), de(r);
	int ans = dfs(mp(l, r));
	de(ans);
	return 0;
}
```
Repeated tests suggest the processor favors taken branches. For this search, the resulting split points are 1, 3, 5, 7, and 8.
Optimized version:
```nasm
ncopy:
	iaddq $-10, %rdx
	jl Rem

Loop:
	mrmovq (%rdi), %r8
	mrmovq 8(%rdi), %r9
	mrmovq 16(%rdi), %r10
	mrmovq 24(%rdi), %r11
	mrmovq 32(%rdi), %r12
	mrmovq 40(%rdi), %r13
	mrmovq 48(%rdi), %r14
	mrmovq 56(%rdi), %rcx
	mrmovq 64(%rdi), %rbx
	mrmovq 72(%rdi), %rbp
	rmmovq %r8, (%rsi)
	rmmovq %r9, 8(%rsi)
	rmmovq %r10, 16(%rsi)
	rmmovq %r11, 24(%rsi)
	rmmovq %r12, 32(%rsi)
	rmmovq %r13, 40(%rsi)
	rmmovq %r14, 48(%rsi)
	rmmovq %rcx, 56(%rsi)
	rmmovq %rbx, 64(%rsi)
	rmmovq %rbp, 72(%rsi)
	andq %r8, %r8
	jle R10N8
	iaddq $1, %rax
R10N8:
	andq %r9, %r9
	jle R10N9
	iaddq $1, %rax
R10N9:
	andq %r10, %r10
	jle R10N10
	iaddq $1, %rax
R10N10:
	andq %r11, %r11
	jle R10N11
	iaddq $1, %rax
R10N11:
	andq %r12, %r12
	jle R10N12
	iaddq $1, %rax
R10N12:
	andq %r13, %r13
	jle R10N13
	iaddq $1, %rax
R10N13:
	andq %r14, %r14
	jle R10N14
	iaddq $1, %rax
R10N14:
	andq %rcx, %rcx
	jle R10N15
	iaddq $1, %rax
R10N15:
	andq %rbx, %rbx
	jle R10N16
	iaddq $1, %rax
R10N16:
	andq %rbp, %rbp
	jle R10N17
	iaddq $1, %rax
R10N17:
	iaddq $80, %rdi
	iaddq $80, %rsi
	iaddq $-10, %rdx
	jge Loop

Rem:
	mrmovq (%rdi), %r8
	iaddq $7, %rdx
	jge RGE3
R02:
	iaddq $2, %rdx
	jl Done
	rmmovq %r8, (%rsi)
	je R1
	jmp R2

R46:
	iaddq $2, %rdx
	jl R4
	je R5
	jmp R6

RGE3:
	rmmovq %r8, (%rsi)
	je R3

R49:	
	iaddq $-4, %rdx
	jl R46
	je R7

R89:
	iaddq $-1, %rdx
	je R8

R9:
	andq %r8, %r8
	mrmovq 64(%rdi), %r8
	jle R9NP
	iaddq $1, %rax
	R9NP:
	rmmovq %r8, 64(%rsi)
R8:
	andq %r8, %r8
	mrmovq 56(%rdi), %r8
	jle R8NP
	iaddq $1, %rax
	R8NP:
	rmmovq %r8, 56(%rsi)
R7:
	andq %r8, %r8
	mrmovq 48(%rdi), %r8
	jle R7NP
	iaddq $1, %rax
	R7NP:
	rmmovq %r8, 48(%rsi)
R6:
	andq %r8, %r8
	mrmovq 40(%rdi), %r8
	jle R6NP
	iaddq $1, %rax
	R6NP:
	rmmovq %r8, 40(%rsi)
R5:
	andq %r8, %r8
	mrmovq 32(%rdi), %r8
	jle R5NP
	iaddq $1, %rax
	R5NP:
	rmmovq %r8, 32(%rsi)
R4:
	andq %r8, %r8
	mrmovq 24(%rdi), %r8
	jle R4NP
	iaddq $1, %rax
	R4NP:
	rmmovq %r8, 24(%rsi)
R3:
	andq %r8, %r8
	mrmovq 16(%rdi), %r8
	jle R3NP
	iaddq $1, %rax
	R3NP:
	rmmovq %r8, 16(%rsi)
R2:
	andq %r8, %r8
	mrmovq 8(%rdi), %r8
	jle R2NP
	iaddq $1, %rax
	R2NP:
	rmmovq %r8, 8(%rsi)
R1:
	andq %r8, %r8
	jle Done
	iaddq $1, %rax
```
Measure CPE again.

```shell
68/68 pass correctness test
Average CPE     7.49
Score   60.0/60.0
```



```C
void transpose_submit(int M, int N, int A[N][M], int B[M][N])
{
    if(M == 32){
        for (int i = 0; i < 32; i++) {
            for (int j = 0; j < 32 ; j++) {
                int temp = A[i][j];
                B[j][i] = temp;
            }
        }
    }
}
```
```shell
$ ./test-trans -M 32 -N 32

Function 0 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 0 (Transpose submission): hits:869, misses:1184, evictions:1152

Function 1 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 1 (Simple row-wise scan transpose): hits:869, misses:1184, evictions:1152

Summary for official submission (func 0): correctness=1 misses=1184

TEST_TRANS_RESULTS=1:1184
```

```C
char trans_desc[] = "Simple row-wise scan transpose";
void transtranspose_submit(int M, int N, int A[N][M], int B[M][N])
{
    int i, j;

    for (i = 0; i < N; i+=8) {
        for (j = 0; j < M; j+=8) {
            for (int m = i; m < i + 8; ++m){
			    for (int n = j; n < j + 8; ++n){
					B[n][m] = A[m][n];
				}
            }           
        }
    }    
}
```

```shell
./test-trans -M 32 -N 32

Function 0 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 0 (Transpose submission): hits:1709, misses:344, evictions:312

Function 1 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 1 (Simple row-wise scan transpose): hits:869, misses:1184, evictions:1152

Summary for official submission (func 0): correctness=1 misses=344

TEST_TRANS_RESULTS=1:344
```
```C
void transpose_submit(int M, int N, int A[N][M], int B[M][N])
{
    int i, j, k;

    for (i = 0; i < N; i+=8) {
        for (j = 0; j < M; j+=8) {
            for(k = i; k < (i + 8); ++k){
				int v1 = A[k][j];
				int v2 = A[k][j+1];
				int v3 = A[k][j+2];
				int v4 = A[k][j+3];
				int v5 = A[k][j+4];
				int v6 = A[k][j+5];
				int v7 = A[k][j+6];			
				int v8 = A[k][j+7];
				B[j][k] = v1;
				B[j+1][k] = v2;
				B[j+2][k] = v3;
				B[j+3][k] = v4;
				B[j+4][k] = v5;
				B[j+5][k] = v6;
				B[j+6][k] = v7;
				B[j+7][k] = v8;
			}
        }
    }
}
```
```shell
./test-trans -M 32 -N 32

Function 0 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 0 (Transpose submission): hits:1765, misses:288, evictions:256

Function 1 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 1 (Simple row-wise scan transpose): hits:869, misses:1184, evictions:1152

Summary for official submission (func 0): correctness=1 misses=288

TEST_TRANS_RESULTS=1:288
```

```shell
$ ./test-trans -M 64 -N 64

Function 0 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 0 (Transpose submission): hits:3585, misses:4612, evictions:4580

Function 1 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 1 (Simple row-wise scan transpose): hits:3473, misses:4724, evictions:4692

Summary for official submission (func 0): correctness=1 misses=4612

TEST_TRANS_RESULTS=1:4612
```
```C
void transpose_submit(int M, int N, int A[N][M], int B[M][N])
{
    int i, j, k;

    for (i = 0; i < N; i+=4) {
        for (j = 0; j < M; j+=4) {
            for(k = i; k < (i + 4); ++k){
				int v1 = A[k][j];
				int v2 = A[k][j+1];
				int v3 = A[k][j+2];
				int v4 = A[k][j+3];
				B[j][k] = v1;
				B[j+1][k] = v2;
				B[j+2][k] = v3;
				B[j+3][k] = v4;
			}          
        }
    }    
}
```
```shell
$ ./test-trans -M 64 -N 64

Function 0 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 0 (Transpose submission): hits:6497, misses:1700, evictions:1668

Function 1 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 1 (Simple row-wise scan transpose): hits:3473, misses:4724, evictions:4692

Summary for official submission (func 0): correctness=1 misses=1700

TEST_TRANS_RESULTS=1:1700
```
https://zhuanlan.zhihu.com/p/42754565
```C
if (M == 64) {
    int i, j;
    int x1,x2,x3,x4,x5,x6,x7,x8;
    for (i = 0; i < N; i += 8) {
        for (j = 0; j < M; j += 8) {
            for (int x = i; x < i + 4; ++x){
                x1 = A[x][j]; x2 = A[x][j+1]; x3 = A[x][j+2]; x4 = A[x][j+3];
                x5 = A[x][j+4]; x6 = A[x][j+5]; x7 = A[x][j+6]; x8 = A[x][j+7];
                
                B[j][x] = x1; B[j+1][x] = x2; B[j+2][x] = x3; B[j+3][x] = x4;
                B[j][x+4] = x5; B[j+1][x+4] = x6; B[j+2][x+4] = x7; B[j+3][x+4] = x8;
            }
            for (int y = j; y < j + 4; ++y){
                x1 = A[i+4][y]; x2 = A[i+5][y]; x3 = A[i+6][y]; x4 = A[i+7][y];
                x5 = B[y][i+4]; x6 = B[y][i+5]; x7 = B[y][i+6]; x8 = B[y][i+7];
                
                B[y][i+4] = x1; B[y][i+5] = x2; B[y][i+6] = x3; B[y][i+7] = x4;
                B[y+4][i] = x5; B[y+4][i+1] = x6; B[y+4][i+2] = x7; B[y+4][i+3] = x8;
            }
            for (int x = i + 4; x < i + 8; ++x){
                x1 = A[x][j+4]; x2 = A[x][j+5]; x3 = A[x][j+6]; x4 = A[x][j+7];
                B[j+4][x] = x1; B[j+5][x] = x2; B[j+6][x] = x3; B[j+7][x] = x4;
            }
        }
    }
}
```
```shell
$ ./test-trans -M 64 -N 64

Function 0 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 0 (Transpose submission): hits:9065, misses:1180, evictions:1148

Function 1 (2 total)
Step 1: Validating and generating memory traces
Step 2: Evaluating performance (s=5, E=1, b=5)
func 1 (Simple row-wise scan transpose): hits:3473, misses:4724, evictions:4692

Summary for official submission (func 0): correctness=1 misses=1180

TEST_TRANS_RESULTS=1:1180
```

```shell
$ python3 driver.py
Part A: Testing cache simulator
Running ./test-csim
                        Your simulator     Reference simulator
Points (s,E,b)    Hits  Misses  Evicts    Hits  Misses  Evicts
     3 (1,1,1)       9       8       6       9       8       6  traces/yi2.trace
     3 (4,2,4)       4       5       2       4       5       2  traces/yi.trace
     3 (2,1,4)       2       3       1       2       3       1  traces/dave.trace
     3 (2,1,3)     167      71      67     167      71      67  traces/trans.trace
     3 (2,2,3)     201      37      29     201      37      29  traces/trans.trace
     3 (2,4,3)     212      26      10     212      26      10  traces/trans.trace
     3 (5,1,5)     231       7       0     231       7       0  traces/trans.trace
     6 (5,1,5)  265189   21775   21743  265189   21775   21743  traces/long.trace
    27


Part B: Testing transpose function
Running ./test-trans -M 32 -N 32
Running ./test-trans -M 64 -N 64
Running ./test-trans -M 61 -N 67

Cache Lab summary:
                        Points   Max pts      Misses
Csim correctness          27.0        27
Trans perf 32x32           8.0         8         288
Trans perf 64x64           8.0         8        1180
Trans perf 61x67          10.0        10        1906
          Total points    53.0        53
