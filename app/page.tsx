import { RouteGuard } from "@/components/route-guard";
import { CitizenHome } from "@/components/citizen-home";

export default function CitizenPage() {
    return (
        <RouteGuard allowedRoles={["citizen"]}>
            <CitizenHome />
        </RouteGuard>
    );
}
