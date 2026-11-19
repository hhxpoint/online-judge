import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type Problem = {
  id: number
  title: string
  slug: string
  difficulty: 'easy' | 'medium' | 'hard'
  description: string
  input_description: string | null
  output_description: string | null
  sample_input: string | null
  sample_output: string | null
  time_limit: number
  memory_limit: number
  tags: string[]
  accepted_count: number
  submission_count: number
  created_at: string
}

export type Submission = {
  id: number
  user_id: string
  problem_id: number
  language: 'cpp' | 'python'
  code: string
  status: 'pending' | 'judging' | 'accepted' | 'wrong_answer' | 'time_limit_exceeded' | 'memory_limit_exceeded' | 'runtime_error' | 'compile_error'
  execution_time: number | null
  execution_memory: number | null
  error_message: string | null
  created_at: string
}

export const statusLabels: Record<Submission['status'], string> = {
  pending: '等待中',
  judging: '评测中',
  accepted: '通过',
  wrong_answer: '答案错误',
  time_limit_exceeded: '超时',
  memory_limit_exceeded: '内存超限',
  runtime_error: '运行错误',
  compile_error: '编译错误',
}

export const statusColors: Record<Submission['status'], string> = {
  pending: 'text-yellow-500',
  judging: 'text-blue-500',
  accepted: 'text-green-500',
  wrong_answer: 'text-red-500',
  time_limit_exceeded: 'text-orange-500',
  memory_limit_exceeded: 'text-orange-500',
  runtime_error: 'text-red-500',
  compile_error: 'text-red-500',
}

export const difficultyLabels: Record<Problem['difficulty'], string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export const difficultyColors: Record<Problem['difficulty'], string> = {
  easy: 'text-green-500',
  medium: 'text-yellow-500',
  hard: 'text-red-500',
}
