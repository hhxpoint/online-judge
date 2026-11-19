"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import type { Problem, Submission } from "@/lib/utils"
import { statusLabels, statusColors, difficultyLabels, difficultyColors } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { User as UserIcon, Calendar, Trophy, Code, CheckCircle, XCircle, Clock, MemoryStick } from "lucide-react"
import Link from "next/link"

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  accepted_count: number
  submission_count: number
  created_at: string
}

interface SolvedProblem {
  problem_id: number
  solved_at: string
  problems: {
    id: number
    title: string
    slug: string
    difficulty: string
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [solvedProblems, setSolvedProblems] = useState<SolvedProblem[]>([])
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    display_name: "",
    bio: "",
  })

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      router.push("/login")
      return
    }
    setUser(session.user)
    fetchProfile(session.user.id)
    fetchSolvedProblems(session.user.id)
    fetchRecentSubmissions(session.user.id)
  }

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (data) {
      setProfile(data)
      setEditForm({
        display_name: data.display_name || "",
        bio: data.bio || "",
      })
    }
    setLoading(false)
  }

  async function fetchSolvedProblems(userId: string) {
    const { data } = await supabase
      .from("user_solved_problems")
      .select(`
        problem_id,
        solved_at,
        problems:problem_id (id, title, slug, difficulty)
      `)
      .eq("user_id", userId)
      .order("solved_at", { ascending: false })

    setSolvedProblems(data || [])
  }

  async function fetchRecentSubmissions(userId: string) {
    const { data } = await supabase
      .from("submissions")
      .select("*, problems:problem_id (title, slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)

    setRecentSubmissions(data || [])
  }

  async function handleSaveProfile() {
    if (!user) return

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editForm.display_name,
        bio: editForm.bio,
      })
      .eq("id", user.id)

    if (!error) {
      setProfile(prev => prev ? {
        ...prev,
        display_name: editForm.display_name,
        bio: editForm.bio,
      } : null)
      setEditing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <p className="text-muted-foreground">用户不存在</p>
      </div>
    )
  }

  const acceptanceRate = profile.submission_count > 0
    ? Math.round((profile.accepted_count / profile.submission_count) * 100)
    : 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Profile Header */}
        <div className="border rounded-lg p-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-10 h-10 text-primary" />
              )}
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">昵称</label>
                    <input
                      type="text"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">个人简介</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="介绍一下自己..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveProfile}>保存</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>取消</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      编辑资料
                    </Button>
                  </div>
                  <p className="text-muted-foreground">@{profile.username}</p>
                  {profile.bio && (
                    <p className="mt-2 text-sm">{profile.bio}</p>
                  )}
                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      加入于 {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-primary">{profile.accepted_count}</div>
            <div className="text-sm text-muted-foreground">已解决</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">{profile.submission_count}</div>
            <div className="text-sm text-muted-foreground">总提交</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-500">{acceptanceRate}%</div>
            <div className="text-sm text-muted-foreground">通过率</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold">{solvedProblems.length}</div>
            <div className="text-sm text-muted-foreground">解题数</div>
          </div>
        </div>

        {/* Solved Problems */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            已解决的题目
          </h2>
          {solvedProblems.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">还没有解决任何题目</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {solvedProblems.map((item) => (
                <Link
                  key={item.problem_id}
                  href={`/problem/${item.problems.slug}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{item.problems.title}</span>
                  </div>
                  <Badge
                    variant={
                      item.problems.difficulty === "easy"
                        ? "success"
                        : item.problems.difficulty === "medium"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {difficultyLabels[item.problems.difficulty as keyof typeof difficultyLabels]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Submissions */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Code className="h-5 w-5" />
            最近提交
          </h2>
          {recentSubmissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">还没有提交记录</p>
          ) : (
            <div className="space-y-3">
              {recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
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
                    <Link
                      href={`/problem/${(submission as any).problems?.slug}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {(submission as any).problems?.title || "未知题目"}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {submission.language.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {submission.execution_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {submission.execution_time}ms
                      </span>
                    )}
                    <span>{new Date(submission.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}