import { redirect } from "next/navigation";

export default function AssignedApplicationsRedirect() {
    redirect("/dashboard/agent/clients");
}