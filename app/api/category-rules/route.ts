import { NextRequest, NextResponse } from "next/server";
import { readUserCategoryRules, upsertUserCategoryRule } from "@/lib/category-rules-server";

export async function GET() {
  const rules = await readUserCategoryRules();
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { description?: string; category?: string };

  if (!body.description || !body.category) {
    return NextResponse.json({ error: "Description and category are required." }, { status: 400 });
  }

  const rules = await upsertUserCategoryRule(body.description, body.category);
  return NextResponse.json({ rules });
}
