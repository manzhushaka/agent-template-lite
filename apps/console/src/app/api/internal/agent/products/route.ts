import { NextResponse } from "next/server";
import { internalAuthorized } from "@/lib/auth";
import { listProducts } from "@/lib/demo-service";

export async function GET(request: Request) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  return NextResponse.json({ items: await listProducts(new URL(request.url).searchParams.get("q") || "") });
}
