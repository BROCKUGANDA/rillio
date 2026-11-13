import { POST as cancelPost } from "../subscription/route";

export async function POST() {
  return cancelPost();
}
