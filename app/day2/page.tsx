import { permanentRedirect } from "next/navigation";
import { ROUTES } from "@/lib/navigation/config";

export default function Day2Page() {
  permanentRedirect(ROUTES.home);
}
