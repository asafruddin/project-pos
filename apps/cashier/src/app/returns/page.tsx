import { redirect } from "next/navigation";

export default function ReturnsRedirectPage() {
  redirect("/transactions");
}
