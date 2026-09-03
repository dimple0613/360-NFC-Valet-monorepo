import { MapPinIcon } from "lucide-react";
import { requireIdentity } from "@/lib/auth/current-user";
import LocationsManager from "./LocationsManager";

export default async function LocationsPage() {
  await requireIdentity();
  return (
    <div className="flex flex-col gap-6">
      <LocationsManager />
    </div>
  );
}
