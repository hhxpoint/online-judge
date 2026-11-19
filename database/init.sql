-- ============================================
-- Online Judge Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  accepted_count INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Problems Table
CREATE TABLE IF NOT EXISTS public.problems (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  description TEXT NOT NULL,
  input_description TEXT,
  output_description TEXT,
  sample_input TEXT,
  sample_output TEXT,
  time_limit INTEGER DEFAULT 1000,  -- ms
  memory_limit INTEGER DEFAULT 256, -- MB
  test_input TEXT,
  test_output TEXT,
  tags TEXT[] DEFAULT '{}',
  accepted_count INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  problem_id BIGINT REFERENCES public.problems(id) ON DELETE CASCADE NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('cpp', 'python')),
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'judging', 'accepted', 'wrong_answer', 
    'time_limit_exceeded', 'memory_limit_exceeded', 
    'runtime_error', 'compile_error'
  )),
  execution_time INTEGER,   -- ms
  execution_memory INTEGER, -- KB
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON public.problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_slug ON public.problems(slug);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem ON public.submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON public.submissions(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Problems policies (public read, admin write)
CREATE POLICY "Problems are viewable by everyone" 
  ON public.problems FOR SELECT USING (true);

-- Submissions policies
CREATE POLICY "Submissions are viewable by owner" 
  ON public.submissions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own submissions" 
  ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_problems_updated_at
  BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Enable Realtime for submissions
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- ============================================
-- Seed Data: Sample Problems
-- ============================================
INSERT INTO public.problems (title, slug, difficulty, description, input_description, output_description, sample_input, sample_output, test_input, test_output) VALUES
(
  'A + B 问题',
  'a-plus-b',
  'easy',
  '## 题目描述

输入两个整数 $a$ 和 $b$，计算并输出它们的和。

### 数据范围

- $-1000 \\le a, b \\le 1000$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入两个整数 $a$ 和 $b$，用空格分隔。',
  '输出一个整数，表示 $a + b$ 的值。',
  '1 2',
  '3',
  '3 5
-10 20
0 0',
  '8
10
0'
),
(
  '斐波那契数列',
  'fibonacci',
  'easy',
  '## 题目描述

给定一个整数 $n$，输出斐波那契数列的第 $n$ 项。

斐波那契数列定义如下：

- $F(0) = 0$
- $F(1) = 1$
- $F(n) = F(n-1) + F(n-2)$，当 $n \\ge 2$

### 数据范围

- $0 \\le n \\le 30$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入一个整数 $n$。',
  '输出一个整数，表示斐波那契数列的第 $n$ 项。',
  '10',
  '55',
  '0
1
10
20',
  '0
1
55
6765'
),
(
  '快速排序',
  'quick-sort',
  'medium',
  '## 题目描述

给定一个长度为 $n$ 的整数数组，请将数组中的元素按升序排列并输出。

### 数据范围

- $1 \\le n \\le 10^5$
- $-10^9 \\le a_i \\le 10^9$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '第一行输入一个整数 $n$，表示数组长度。第二行输入 $n$ 个整数，表示数组元素。',
  '输出一行 $n$ 个整数，表示排序后的数组。',
  '5
3 1 4 1 5',
  '1 1 3 4 5',
  '3
5 4 3
1
42
5
-2 3 -1 0 1',
  '3 4 5
42
-2 -1 0 1 3'
),
(
  '最长公共子序列',
  'longest-common-subsequence',
  'hard',
  '## 题目描述

给定两个字符串 $s$ 和 $t$，求它们的最长公共子序列的长度。

### 数据范围

- $1 \\le |s|, |t| \\le 1000$

## 样例

你可以参考下面的样例输入输出来理解题目要求。',
  '输入两行，每行一个字符串，分别表示 $s$ 和 $t$。',
  '输出一个整数，表示最长公共子序列的长度。',
  'abcde
ace',
  '3',
  'abc
abc
abc
def
abcde
ace
aabaa
aaaaa',
  '3
0
3
4'
);
