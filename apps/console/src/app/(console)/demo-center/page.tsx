import { redirect } from "next/navigation";
import { publicPath } from "@/lib/public-path";

export default function DemoCenterPage() {
  redirect(publicPath("/demo-center/products"));
}
