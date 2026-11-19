-- ============================================
-- Migration: Add Comments Table and Enhancements
-- Run this in Supabase SQL Editor
-- ============================================

-- 4. Comments Table (for problem discussions)
CREATE TABLE IF NOT EXISTS public.comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  problem_id BIGINT REFERENCES public.problems(id) ON DELETE CASCADE NOT NULL,
  parent_id BIGINT REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Solved Problems (track which problems each user has solved)
CREATE TABLE IF NOT EXISTS public.user_solved_problems (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  problem_id BIGINT REFERENCES public.problems(id) ON DELETE CASCADE NOT NULL,
  solved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id)
);

-- ============================================
-- Indexes for new tables
-- ============================================
CREATE INDEX IF NOT EXISTS idx_comments_problem ON public.comments(problem_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_user_solved_user ON public.user_solved_problems(user_id);
CREATE INDEX IF NOT EXISTS idx_user_solved_problem ON public.user_solved_problems(problem_id);

-- ============================================
-- Row Level Security (RLS) for new tables
-- ============================================

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_solved_problems ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" 
  ON public.comments FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" 
  ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" 
  ON public.comments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" 
  ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- User solved problems policies
CREATE POLICY "User solved problems are viewable by owner" 
  ON public.user_solved_problems FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own solved problems" 
  ON public.user_solved_problems FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Triggers for new tables
-- ============================================

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- Function to update user solved count
-- ============================================
CREATE OR REPLACE FUNCTION public.update_user_solved_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles 
    SET accepted_count = accepted_count + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles 
    SET accepted_count = accepted_count - 1
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_solved_change
  AFTER INSERT OR DELETE ON public.user_solved_problems
  FOR EACH ROW EXECUTE FUNCTION public.update_user_solved_count();

-- ============================================
-- Function to update problem submission count
-- ============================================
CREATE OR REPLACE FUNCTION public.update_problem_submission_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.problems 
    SET submission_count = submission_count + 1
    WHERE id = NEW.problem_id;
    IF NEW.status = 'accepted' THEN
      UPDATE public.problems 
      SET accepted_count = accepted_count + 1
      WHERE id = NEW.problem_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
      UPDATE public.problems 
      SET accepted_count = accepted_count + 1
      WHERE id = NEW.problem_id;
    ELSIF OLD.status = 'accepted' AND NEW.status != 'accepted' THEN
      UPDATE public.problems 
      SET accepted_count = accepted_count - 1
      WHERE id = NEW.problem_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_submission_change
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_problem_submission_count();

-- ============================================
-- Enable Realtime for comments
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- ============================================
-- More Sample Problems
-- ============================================
INSERT INTO public.problems (title, slug, difficulty, description, input_description, output_description, sample_input, sample_output, test_input, test_output, tags) VALUES
(
  '两数之和',
  'two-sum',
  'easy',
  '## 题目描述

给定一个整数数组 $nums$ 和一个整数目标值 $target$，请你在该数组中找出和为目标值 $target$ 的那两个整数，并返回它们的数组下标。

你可以假设每种输入只会对应一个答案。但是，数组中同一个元素在答案里不能重复出现。

你可以按任意顺序返回答案。

### 数据范围

- $2 \\le nums.length \\le 10^4$
- $-10^9 \\le nums[i] \\le 10^9$
- $-10^9 \\le target \\le 10^9$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '第一行输入一个整数 $n$，表示数组长度。第二行输入 $n$ 个整数，表示数组元素。第三行输入一个整数 $target$。',
  '输出两个整数，表示两个数的下标（从0开始）。',
  '4
2 7 11 15
9',
  '0 1',
  '3
3 2 4
6
2
2 7 11 15
9',
  '1 2
0 1',
  ARRAY['数组', '哈希表']
),
(
  '回文数',
  'palindrome-number',
  'easy',
  '## 题目描述

给你一个整数 $x$，如果 $x$ 是一个回文整数，返回 $true$；否则，返回 $false$。

回文数是指正序（从左向右）和倒序（从右向左）读都是一样的整数。

例如，$121$ 是回文，而 $123$ 不是。

### 数据范围

- $-2^{31} \\le x \\le 2^{31} - 1$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入一个整数 $x$。',
  '输出 $true$ 或 $false$。',
  '121',
  'true',
  '121
-121
10',
  'true
false
false',
  ARRAY['数学']
),
(
  '有效的括号',
  'valid-parentheses',
  'easy',
  '## 题目描述

给定一个只包括 $"(", ")"$"、"$"{"$"、"$"}"、"$"["、"$"]"$ 的字符串 $s$，判断字符串是否有效。

有效字符串需满足：

1. 左括号必须用相同类型的右括号闭合。
2. 左括号必须以正确的顺序闭合。
3. 每个右括号都有一个对应的相同类型的左括号。

### 数据范围

- $1 \\le s.length \\le 10^4$
- $s$ 仅由括号 $"()[]{}"$ 组成

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入一个字符串 $s$。',
  '输出 $true$ 或 $false$。',
  '()',
  'true',
  '()
()[]{}
(]
([)]
{[]}',
  'true
true
false
false
true',
  ARRAY['栈', '字符串']
),
(
  '合并两个有序链表',
  'merge-two-sorted-lists',
  'easy',
  '## 题目描述

将两个升序链表合并为一个新的升序链表。新链表是通过拼接给定的两个链表的所有节点组成的。

### 数据范围

- 两个链表的节点数目范围是 $[0, 50]$
- $-100 \\le Node.val \\le 100$
- $l1$ 和 $l2$ 均按非递减顺序排列

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '第一行输入链表 $l1$ 的节点值（空格分隔），第二行输入链表 $l2$ 的节点值（空格分隔）。输入 $-1$ 表示空链表。',
  '输出合并后的链表节点值（空格分隔）。',
  '1 2 4
1 3 4',
  '1 1 2 3 4 4',
  '1 2 4
1 3 4
-1
-1
-1
1',
  '1 1 2 3 4 4

1',
  ARRAY['链表', '递归']
),
(
  '最大子数组和',
  'maximum-subarray',
  'medium',
  '## 题目描述

给你一个整数数组 $nums$，请你找出一个具有最大和的连续子数组（子数组最少包含一个元素），返回其最大和。

子数组是数组中的一个连续部分。

### 数据范围

- $1 \\le nums.length \\le 10^5$
- $-10^4 \\le nums[i] \\le 10^4$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '第一行输入一个整数 $n$，表示数组长度。第二行输入 $n$ 个整数，表示数组元素。',
  '输出一个整数，表示最大子数组和。',
  '9
-2 1 -3 4 -1 2 1 -5 4',
  '6',
  '1
1
5
-1 -2 -3 -4 -5
9
-2 1 -3 4 -1 2 1 -5 4',
  '1
-1
6',
  ARRAY['数组', '动态规划', '分治']
),
(
  '爬楼梯',
  'climbing-stairs',
  'easy',
  '## 题目描述

假设你正在爬楼梯。需要 $n$ 阶你才能到达楼顶。

每次你可以爬 $1$ 或 $2$ 个台阶。你有多少种不同的方法可以爬到楼顶呢？

### 数据范围

- $1 \\le n \\le 45$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入一个整数 $n$。',
  '输出一个整数，表示不同的方法数。',
  '2',
  '2',
  '2
3
5
10',
  '2
3
8
89',
  ARRAY['动态规划', '记忆化搜索']
),
(
  '二叉树的中序遍历',
  'binary-tree-inorder-traversal',
  'easy',
  '## 题目描述

给定一个二叉树的根节点 $root$，返回它的中序遍历。

### 数据范围

- 树中节点数目在范围 $[0, 100]$ 内
- $-100 \\le Node.val \\le 100$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入二叉树的层序遍历结果，用空格分隔，$null$ 表示空节点。',
  '输出中序遍历结果，用空格分隔。',
  '1 null 2 3',
  '1 3 2',
  '1 null 2 3
-1
1 2 3 4 5',
  '1 3 2

4 2 5 1 3',
  ARRAY['树', '栈', '递归']
),
(
  '反转链表',
  'reverse-linked-list',
  'easy',
  '## 题目描述

给你单链表的头节点 $head$，请你反转链表，并返回反转后的链表。

### 数据范围

- 链表中节点的数目范围是 $[0, 5000]$
- $-5000 \\le Node.val \\le 5000$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入链表的节点值，用空格分隔。',
  '输出反转后的链表节点值，用空格分隔。',
  '1 2 3 4 5',
  '5 4 3 2 1',
  '1 2 3 4 5
1 2
-1',
  '5 4 3 2 1
2 1

',
  ARRAY['链表', '递归']
),
(
  '最小栈',
  'min-stack',
  'medium',
  '## 题目描述

设计一个支持 $push$，$pop$，$top$ 操作，并能在常数时间内检索到最小元素的栈。

实现 $MinStack$ 类:

- $MinStack()$ 初始化堆栈对象。
- $void push(int val)$ 将元素 $val$ 推入堆栈。
- $void pop()$ 删除堆栈顶部的元素。
- $int top()$ 获取堆栈顶部元素。
- $int getMin()$ 获取堆栈中的最小元素。

### 数据范围

- $-2^{31} \\le val \\le 2^{31} - 1$
- $pop$、$top$ 和 $getMin$ 操作总是在非空栈上调用
- $push$、$pop$、$top$、和 $getMin$ 最多被调用 $3 \\times 10^4$ 次

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入操作序列，每行一个操作。操作格式：push x / pop / top / getMin。',
  '输出每个 top 和 getMin 操作的结果。',
  'push -2
push 0
push -3
getMin
pop
top
getMin',
  '-3
0
-2',
  'push 1
push 2
top
getMin
pop
getMin',
  '2
1
1',
  ARRAY['栈', '设计']
),
(
  '相交链表',
  'intersection-of-two-linked-lists',
  'easy',
  '## 题目描述

给你两个单链表的头节点 $headA$ 和 $headB$，请你找出并返回两个单链表相交的起始节点。如果两个链表不存在相交节点，返回 $null$。

### 数据范围

- $listA$ 中节点数目为 $m$
- $listB$ 中节点数目为 $n$
- $0 \\le m, n \\le 3 \\times 10^4$
- $1 \\le Node.val \\le 10^5$
- $0 \\le skipA \\le m$
- $0 \\le skipB \\le n$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '第一行输入链表 $A$ 的节点值（空格分隔），第二行输入链表 $B$ 的节点值（空格分隔）。第三行输入相交节点的值，$-1$ 表示不相交。',
  '输出相交节点的值，如果不相交输出 $-1$。',
  '4 1 8 4 5
5 6 1 8 4 5
8',
  '8',
  '4 1 8 4 5
5 6 1 8 4 5
8
2 6 4
1 5
-1',
  '8
-1',
  ARRAY['链表', '双指针']
);
