import { redirect } from "next/navigation";

export default function VoidRedirectPage() {
  redirect("/transactions");
}
