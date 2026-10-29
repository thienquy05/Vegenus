import { requireGuest } from "@/lib/guest";
import { GuestHome } from "../guest-home";

export default async function GuestHomePage() {
  return <GuestHome summary={await requireGuest()} />;
}
