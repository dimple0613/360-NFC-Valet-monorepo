import { requireValetPage } from "../_lib/valet-permissions";
import LocationsManager from "./LocationsManager";

export default async function LocationsPage() {
  await requireValetPage("valet.property.read");
  return (
    <div className="flex flex-col gap-6">
      <LocationsManager />
    </div>
  );
}
