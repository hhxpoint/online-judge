import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { submissionId } = await request.json()

    if (!submissionId) {
      return NextResponse.json(
        { error: "Missing submissionId" },
        { status: 400 }
      )
    }

    // Get submission details
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from("submissions")
      .select("*, problems(*)")
      .eq("id", submissionId)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      )
    }

    // Call judge server
    const judgeUrl = process.env.JUDGE_SERVER_URL
    if (!judgeUrl) {
      return NextResponse.json(
        { error: "Judge server not configured" },
        { status: 500 }
      )
    }

    const judgeResponse = await fetch(`${judgeUrl}/judge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: submission.id,
        code: submission.code,
        language: submission.language,
        test_input: submission.problems.test_input,
        test_output: submission.problems.test_output,
        time_limit: submission.problems.time_limit,
        memory_limit: submission.problems.memory_limit,
      }),
    })

    if (!judgeResponse.ok) {
      console.error("Judge server error:", await judgeResponse.text())
      return NextResponse.json(
        { error: "Judge server error" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Submit API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
