"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import type { Problem } from "@/lib/utils"
import { difficultyLabels, difficultyColors } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Filter, X } from "lucide-react"

export function ProblemList() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 10

  useEffect(() => {
    fetchProblems()
    fetchTags()
  }, [search, difficulty, selectedTags, page])

  async function fetchTags() {
    const { data } = await supabase
      .from("problems")
      .select("tags")

    if (data) {
      const allTags = data.flatMap(p => p.tags || [])
      const uniqueTags = Array.from(new Set(allTags)).sort()
      setAvailableTags(uniqueTags)
    }
  }

  async function fetchProblems() {
    setLoading(true)
    let query = supabase
      .from("problems")
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (search) {
      query = query.ilike("title", `%${search}%`)
    }
    if (difficulty) {
      query = query.eq("difficulty", difficulty)
    }
    if (selectedTags.length > 0) {
      query = query.contains("tags", selectedTags)
    }

    const { data, count } = await query
    setProblems(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
    setPage(1)
  }

  const clearFilters = () => {
    setSearch("")
    setDifficulty(null)
    setSelectedTags([])
    setPage(1)
  }

  const hasFilters = search || difficulty || selectedTags.length > 0

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">题库</h1>
        <span className="text-muted-foreground">共 {totalCount} 题</span>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索题目..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <Button
                key={d}
                variant={difficulty === d ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDifficulty(difficulty === d ? null : d)
                  setPage(1)
                }}
              >
                {difficultyLabels[d]}
              </Button>
            ))}
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                清除
              </Button>
            )}
          </div>
        </div>

        {/* Tags Filter */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Problem Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-sm">题号</th>
              <th className="text-left px-4 py-3 font-medium text-sm">题目</th>
              <th className="text-left px-4 py-3 font-medium text-sm">难度</th>
              <th className="text-left px-4 py-3 font-medium text-sm hidden sm:table-cell">通过率</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3">
                    <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </td>
                </tr>
              ))
            ) : problems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  暂无题目
                </td>
              </tr>
            ) : (
              problems.map((problem) => (
                <tr key={problem.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">
                    {problem.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Link
                        href={`/problem/${problem.slug}`}
                        className="hover:text-primary transition-colors font-medium"
                      >
                        {problem.title}
                      </Link>
                      {problem.tags && problem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {problem.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {problem.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{problem.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {problem.submission_count > 0
                      ? `${Math.round(
                          (problem.accepted_count / problem.submission_count) * 100
                        )}% (${problem.accepted_count}/${problem.submission_count})`
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
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
