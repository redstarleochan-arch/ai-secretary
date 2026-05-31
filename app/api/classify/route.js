export async function POST() {
  return Response.json({
    success: false,
    error: "This endpoint is deprecated. Use /api/analyze-capture instead."
  });
}
