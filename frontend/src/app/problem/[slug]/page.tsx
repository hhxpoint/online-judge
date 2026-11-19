import { ProblemDetail } from "@/components/problem/problem-detail"

export default function ProblemPage({
  params,
}: {
  params: { slug: string }
}) {
  return <ProblemDetail slug={params.slug} />
}
