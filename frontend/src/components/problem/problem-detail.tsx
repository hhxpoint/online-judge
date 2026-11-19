"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Problem, Submission } from "@/lib/utils"
import { difficultyLabels, statusLabels, statusColors } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CodeEditor } from "./code-editor"
import { SubmissionHistory } from "./submission-history"
import { Play, Send, Clock, MemoryStick, History, MessageSquare } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ProblemDetailProps {
  slug: string
}

export function ProblemDetail({ slug }: ProblemDetailProps) {
  const [problem, setProblem] = useState<Problem | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState<"cpp" | "python">("cpp")

  useEffect(() => {
    fetchProblem()
    checkUser()
  }, [slug])

  useEffect(() => {
    if (!currentSubmission?.id) return

    const channel = supabase
      .channel(`submission-${currentSubmission.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "submissions",
          filter: `id=eq.${currentSubmission.id}`,
        },
        (payload) => {
          setCurrentSubmission(payload.new as Submission)
          if (
            payload.new.status !== "pending" &&
            payload.new.status !== "judging"
          ) {
            supabase.removeChannel(channel)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentSubmission?.id])

  async function fetchProblem() {
    const { data } = await supabase
      .from("problems")
      .select("*")
      .eq("slug", slug)
      .single()

    setProblem(data)
    setLoading(false)
  }

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
  }

  async function handleSubmit() {
    if (!user || !problem) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          user_id: user.id,
          problem_id: problem.id,
          language,
          code,
          status: "pending",
        })
        .select()
        .single()

      if (error) throw error

      setCurrentSubmission(data)

      // Trigger judge
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: data.id }),
      })
    } catch (error) {
      console.error("Submit error:", error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <p className="text-muted-foreground">题目不存在</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row">
      {/* Left Panel: Problem Description */}
      <div className="lg:w-1/2 border-r overflow-auto">
        <Tabs defaultValue="description" className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="description"
              className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              题目描述
            </TabsTrigger>
            <TabsTrigger
              value="submissions"
              className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <History className="h-4 w-4 mr-2" />
              提交记录
            </TabsTrigger>
            <TabsTrigger
              value="discussion"
              className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              讨论
            </TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="flex-1 overflow-auto p-6 m-0">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{problem.title}</h1>
                <Badge
                  variant={
                    problem.difficulty === "easy"
                      ? "success"
                      : problem.difficulty === "medium"
                      ? "warning"
                      : "danger"
                  }
                >
                  {difficultyLabels[problem.difficulty]}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {problem.time_limit}ms
                </span>
                <span className="flex items-center gap-1">
                  <MemoryStick className="h-4 w-4" />
                  {problem.memory_limit}MB
                </span>
              </div>

              {problem.tags && problem.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {problem.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="prose dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.description) }} />
              </div>

              {problem.input_description && (
                <div>
                  <h3 className="font-semibold mb-2">输入格式</h3>
                  <div className="prose dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.input_description) }} />
                  </div>
                </div>
              )}

              {problem.output_description && (
                <div>
                  <h3 className="font-semibold mb-2">输出格式</h3>
                  <div className="prose dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.output_description) }} />
                  </div>
                </div>
              )}

              {problem.sample_input && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold mb-2">样例输入</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
                      {problem.sample_input}
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">样例输出</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
                      {problem.sample_output}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="flex-1 overflow-auto p-6 m-0">
            <SubmissionHistory problemId={problem.id} userId={user?.id} />
          </TabsContent>

          <TabsContent value="discussion" className="flex-1 overflow-auto p-6 m-0">
            <DiscussionSection problemId={problem.id} user={user} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Panel: Code Editor */}
      <div className="lg:w-1/2 flex flex-col">
        {/* Language Selector & Buttons */}
        <div className="border-b p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "cpp" | "python")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="cpp">C++</option>
              <option value="python">Python</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            {currentSubmission && (
              <span className={`text-sm font-medium ${statusColors[currentSubmission.status]}`}>
                {statusLabels[currentSubmission.status]}
                {currentSubmission.execution_time && (
                  <span className="text-muted-foreground ml-2">
                    {currentSubmission.execution_time}ms
                  </span>
                )}
              </span>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !user || !code.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "提交中..." : "提交"}
            </Button>
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex-1">
          <CodeEditor
            language={language}
            value={code}
            onChange={setCode}
          />
        </div>

        {/* Submission Result */}
        {currentSubmission && currentSubmission.error_message && (
          <div className="border-t p-4">
            <h3 className="font-semibold mb-2 text-red-500">错误信息</h3>
            <pre className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-sm overflow-auto text-red-600 dark:text-red-400">
              {currentSubmission.error_message}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-medium mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/\$([^$]+)\$/g, '<span class="font-mono">$1</span>')
    .replace(/^- (.*$)/gm, '<li class="list-disc ml-6">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/\n/g, '<br/>')
}

interface Comment {
  id: number
  user_id: string
  problem_id: number
  content: string
  likes: number
  created_at: string
  profiles?: {
    username: string
    display_name: string
  }
}

function DiscussionSection({ problemId, user }: { problemId: number; user: any }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [problemId])

  async function fetchComments() {
    const { data } = await supabase
      .from("comments")
      .select(`
        *,
        profiles:user_id (username, display_name)
      `)
      .eq("problem_id", problemId)
      .order("created_at", { ascending: false })

    setComments(data || [])
    setLoading(false)
  }

  async function handleSubmitComment() {
    if (!user || !newComment.trim()) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from("comments")
        .insert({
          user_id: user.id,
          problem_id: problemId,
          content: newComment.trim(),
        })

      if (error) throw error

      setNewComment("")
      fetchComments()
    } catch (error) {
      console.error("Comment error:", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">讨论区</h3>

      {user ? (
        <div className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="分享你的解题思路或提问..."
            className="w-full h-24 p-3 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmitComment}
              disabled={submitting || !newComment.trim()}
            >
              {submitting ? "发送中..." : "发表评论"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          请先登录后再发表评论
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无讨论，来发表第一条评论吧！
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {(comment.profiles?.display_name || comment.profiles?.username || "U")[0].toUpperCase()}
                  </div>
                  <span className="font-medium">
                    {comment.profiles?.display_name || comment.profiles?.username || "匿名用户"}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
