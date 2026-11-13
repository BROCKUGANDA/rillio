import { NextResponse } from "next/server";
import { POST as cancelPost } from "../subscription/route";

export async function POST() {
  return cancelPost();
}
