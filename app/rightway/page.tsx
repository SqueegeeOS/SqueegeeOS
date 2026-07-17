import { permanentRedirect } from "next/navigation";

/** The Right Way graduated to the homepage. Shared links live on. */
export default function RightWayPage() {
  permanentRedirect("/");
}
