"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Trophy, Medal, User } from "lucide-react"
import Link from "next/link"

interface RankedUser {
  id: string
  username: string
  display_name: string
  accepted_count: number
  submission_count: number
  rank: number
}

export default function RankingPage() {
  const [users, setUsers] = useState<RankedUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRanking()
  }, [])

  async function fetchRanking() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, accepted_count, submission_count")
      .order("accepted_count", { ascending: false })
      .limit(100)

    if (data) {
      const rankedUsers = data.map((user, index) => ({
        ...user,
        rank: index + 1,
      }))
      setUsers(rankedUsers)
    }
    setLoading(false)
  }

  function getRankIcon(rank: number) {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
    return <span className="text-muted-foreground font-medium">{rank}</span>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">排行榜</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            暂无排名数据
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-sm w-16">排名</th>
                  <th className="text-left px-4 py-3 font-medium text-sm">用户</th>
                  <th className="text-right px-4 py-3 font-medium text-sm">解题数</th>
                  <th className="text-right px-4 py-3 font-medium text-sm hidden sm:table-cell">提交数</th>
                  <th className="text-right px-4 py-3 font-medium text-sm hidden sm:table-cell">通过率</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const acceptanceRate = user.submission_count > 0
                    ? Math.round((user.accepted_count / user.submission_count) * 100)
                    : 0

                  return (
                    <tr key={user.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center w-8">
                          {getRankIcon(user.rank)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/profile/${user.username}`}
                          className="flex items-center gap-3 hover:text-primary transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{user.display_name || user.username}</div>
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-primary">{user.accepted_count}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                        {user.submission_count}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        <span className={acceptanceRate >= 50 ? "text-green-500" : "text-muted-foreground"}>
                          {acceptanceRate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}