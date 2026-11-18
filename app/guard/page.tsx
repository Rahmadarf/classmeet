import { redirect } from "next/navigation";

export default function GuardIndex() {
  redirect("/guard/scan");
}
