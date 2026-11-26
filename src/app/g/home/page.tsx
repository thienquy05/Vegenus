import { requireGuest } from "@/lib/guest";
import { GuestApp } from "../guest-app";

export default async function GuestHomePage() {
  return <GuestApp summary={await requireGuest()} section="home" />;
}
