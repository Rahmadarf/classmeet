import { redirect } from "next/navigation";

// Beranda admin = Status game (ROLE_HOME).
export default function AdminHome() {
  redirect("/admin/state");
}
