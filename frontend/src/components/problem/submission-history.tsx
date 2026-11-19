"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Submission } from "@/lib/utils"
import { statusLabels, statusColors } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, MemoryStick, Code, Calendar } from "lucide-react"

interface SubmissionHistoryProps {
  problemId: number
  userId?: string
}

export function SubmissionHistory({ problemId, userId }: SubmissionHistoryProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const pageSize = 10

  useEffect(() => {
    fetchSubmissions()
  }, [problemId, userId, page])

  async function fetchSubmissions() {
    setLoading(true)
    let query = supabase
      .from("submissions")
      .select("*", { count: "exact" })
      .eq("problem_id", problemId)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data, count } = await query
    setSubmissions(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">提交记录</h3>
        <span className="text-sm text-muted-foreground">共 {totalCount} 条</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无提交记录
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => setSelectedSubmission(
                selectedSubmission?.id === submission.id ? null : submission
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      submission.status === "accepted"
                        ? "success"
                        : submission.status === "pending" || submission.status === "judging"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {statusLabels[submission.status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Code className="h-4 w-4" />
                    {submission.language.toUpperCase()}
                  </span>
                  {submission.execution_time && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {submission.execution_time}ms
                    </span>
                  )}
                  {submission.execution_memory && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <MemoryStick className="h-4 w-4" />
                      {submission.execution_memory}KB
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(submission.created_at).toLocaleString()}
                </span>
              </div>

              {selectedSubmission?.id === submission.id && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-medium mb-2">代码</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96 font-mono">
                    {submission.code}
                  </pre>
                  {submission.error_message && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2 text-red-500">错误信息</h4>
                      <pre className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-sm overflow-auto text-red-600 dark:text-red-400">
                        {submission.error_message}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}