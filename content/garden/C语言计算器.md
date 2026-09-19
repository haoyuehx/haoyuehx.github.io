---
title: "C语言计算器"
date: 2025-06-18
lastmod: 2025-06-18
draft: false
garden_tags: ["Data Structures"]
summary: " "
status: "evergreen"
---

## 栈实现

```C
#include <ctype.h>
#include <stdio.h>

#define MAX 100

typedef struct {
    double data[MAX];
    int top;
} Stack;

void push(Stack* s, double val)
{
    s->data[++s->top] = val;
}

double pop(Stack* s)
{
    return s->data[s->top--];
}

char top(Stack* s)
{
    return s->data[s->top];
}

int precedence(char op)
{
    if (op == '+' || op == '-')
        return 1;
    if (op == '*' || op == '/')
        return 2;
    return 0;
}

int isOperator(char ch)
{
    return ch == '+' || ch == '-' || ch == '*' || ch == '/';
}

void infixToPostfix(char* expr, char* postfix)
{
    Stack stack;
    stack.top = -1;
    int i = 0, j = 0;
    while (expr[i] != '=') {
        if (isdigit(expr[i])) {
            while (isdigit(expr[i])) {
                postfix[j++] = expr[i++];
            }
            postfix[j++] = ' ';
        } else if (expr[i] == '(') {
            push(&stack, expr[i++]);
        } else if (expr[i] == ')') {
            while (top(&stack) != '(')
                postfix[j++] = pop(&stack);
            pop(&stack);
            i++;
        } else if (isOperator(expr[i])) {
            while (stack.top != -1 && precedence(top(&stack)) >= precedence(expr[i]))
                postfix[j++] = pop(&stack);
            push(&stack, expr[i++]);
        } else {
            i++;
        }
    }
    while (stack.top != -1)
        postfix[j++] = pop(&stack);
    postfix[j] = '\0';
}

double evalPostfix(char* postfix)
{
    Stack stack;
    stack.top = -1;
    int i = 0;
    while (postfix[i]) {
        if (isdigit(postfix[i]) || postfix[i] == '.') {
            double val;
            sscanf(&postfix[i], "%lf", &val);
            push(&stack, val);
            while (isdigit(postfix[i]) || postfix[i] == '.')
                i++;
        } else if (isOperator(postfix[i])) {
            double b = pop(&stack);
            double a = pop(&stack);
            switch (postfix[i]) {
            case '+':
                push(&stack, a + b);
                break;
            case '-':
                push(&stack, a - b);
                break;
            case '*':
                push(&stack, a * b);
                break;
            case '/':
                push(&stack, a / b);
                break;
            }
            i++;
        } else {
            i++;
        }
    }
    return pop(&stack);
}

int main(void)
{
    char expr[MAX], postfix[MAX];
    fgets(expr, MAX, stdin);

    infixToPostfix(expr, postfix);
    double result = evalPostfix(postfix);
    printf("%.2lf\n", result);
    return 0;
}
```

## 二叉树实现
```C
#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef enum {
    NUMBER,
    OPERATOR
} NodeType;

typedef struct Node {
    NodeType type; // 节点类型：数值或运算符
    union {
        int number; // 存储数值
        char op; // 存储运算符（'+', '-', '*', '/'）
    } value;
    struct Node* left; // 左子节点
    struct Node* right; // 右子节点
} Node, *Nodeptr;

typedef struct stack_node {
    Nodeptr node;
    struct stack_node* next;
} stack_node;

typedef struct {
    stack_node* top;
} stack;

void stack_init(stack* s)
{
    s->top = NULL;
}

void stack_push(stack* s, const Nodeptr val)
{
    stack_node* n = malloc(sizeof(stack_node));
    n->node = val;
    n->next = s->top;
    s->top = n;
}

Nodeptr stack_pop(stack* s)
{
    if (!s->top)
        return NULL;
    stack_node* temp = s->top;
    Nodeptr result = temp->node;
    s->top = temp->next;
    free(temp);
    return result;
}

bool stack_is_empty(const stack* s)
{
    return s->top == NULL;
}

Nodeptr stack_peek(const stack* s)
{
    return s->top ? s->top->node : NULL;
}

void stack_destroy(stack* s)
{
    while (!stack_is_empty(s))
        free(stack_pop(s));
}

#define MAX 100

typedef struct {
    int data[MAX];
    int top;
} Stack;

void push(Stack* s, int val)
{
    s->data[++s->top] = val;
}

int pop(Stack* s)
{
    return s->data[s->top--];
}

char top(Stack* s)
{
    return s->data[s->top];
}

int precedence(char op)
{
    if (op == '+' || op == '-')
        return 1;
    if (op == '*' || op == '/')
        return 2;
    return 0;
}

int isOperator(char ch)
{
    return ch == '+' || ch == '-' || ch == '*' || ch == '/';
}

void infixToPostfix(char* expr, char* postfix)
{
    Stack stack;
    stack.top = -1;
    int i = 0, j = 0;
    while (expr[i] != '=') {
        if (isdigit(expr[i])) {
            while (isdigit(expr[i])) {
                postfix[j++] = expr[i++];
            }
            postfix[j++] = ' ';
        } else if (expr[i] == '(') {
            push(&stack, expr[i++]);
        } else if (expr[i] == ')') {
            while (top(&stack) != '(')
                postfix[j++] = pop(&stack);
            pop(&stack);
            i++;
        } else if (isOperator(expr[i])) {
            while (stack.top != -1 && precedence(top(&stack)) >= precedence(expr[i]))
                postfix[j++] = pop(&stack);
            push(&stack, expr[i++]);
        } else {
            i++;
        }
    }
    while (stack.top != -1)
        postfix[j++] = pop(&stack);
    postfix[j] = '\0';
}

int evalPostfix(char* postfix)
{
    Stack stack;
    stack.top = -1;
    int i = 0;
    while (postfix[i]) {
        if (isdigit(postfix[i]) || postfix[i] == '.') {
            int val;
            sscanf(&postfix[i], "%d", &val);
            push(&stack, val);
            while (isdigit(postfix[i]) || postfix[i] == '.')
                i++;
        } else if (isOperator(postfix[i])) {
            int b = pop(&stack);
            int a = pop(&stack);
            switch (postfix[i]) {
            case '+':
                push(&stack, a + b);
                break;
            case '-':
                push(&stack, a - b);
                break;
            case '*':
                push(&stack, a * b);
                break;
            case '/':
                push(&stack, a / b);
                break;
            }
            i++;
        } else {
            i++;
        }
    }
    return pop(&stack);
}

Nodeptr postfix_to_tree(char* postfix)
{
    stack stack;
    stack_init(&stack);
    int len = strlen(postfix);

    int i = 0;
    while (i < len) {
        Nodeptr newnode = (Nodeptr)malloc(sizeof(Node));
        if (isdigit(postfix[i])) {
            int num = postfix[i++] - '0';
            while (isdigit(postfix[i])) {
                num = num * 10 + (postfix[i++] - '0');
            }
            newnode->type = NUMBER;
            newnode->value.number = num;
            newnode->left = NULL;
            newnode->right = NULL;
            stack_push(&stack, newnode);
        } else if (isOperator(postfix[i])) {
            newnode->type = OPERATOR;
            newnode->value.op = postfix[i];
            Nodeptr right = stack_peek(&stack);
            stack_pop(&stack);
            Nodeptr left = stack_peek(&stack);
            stack_pop(&stack);
            newnode->left = left;
            newnode->right = right;
            stack_push(&stack, newnode);
            i++;
        } else {
            i++;
        }
    }
    return stack_peek(&stack);
}

int evalPostfixt(Nodeptr root)
{
    if (root->left == NULL && root->right == NULL) {
        return root->value.number;
    } else {
        if (root->type == OPERATOR) {
            switch (root->value.op) {
            case '+':
                return evalPostfixt(root->left) + evalPostfixt(root->right);
                break;
            case '-':
                return evalPostfixt(root->left) - evalPostfixt(root->right);
                break;
            case '*':
                return evalPostfixt(root->left) * evalPostfixt(root->right);
                break;
            case '/':
                return evalPostfixt(root->left) / evalPostfixt(root->right);
                break;
            }
        }
    }
    return 0;
}

int main(void)
{
    char expr[MAX], postfix[MAX];
    fgets(expr, MAX, stdin);

    infixToPostfix(expr, postfix);

    Nodeptr root = postfix_to_tree(postfix);
    if (root != NULL) {
        (root->type == NUMBER) ? printf("%d", root->value.number) : printf("%c", root->value.op);
    }
    if (root->left != NULL) {
        (root->left->type == NUMBER) ? printf(" %d", root->left->value.number) : printf(" %c", root->left->value.op);
    }
    if (root->right != NULL) {
        (root->right->type == NUMBER) ? printf(" %d", root->right->value.number) : printf(" %c", root->right->value.op);
    }

    printf("\n");

    int ans = evalPostfixt(root);
    printf("%d\n", ans);
    return 0;
}
```
