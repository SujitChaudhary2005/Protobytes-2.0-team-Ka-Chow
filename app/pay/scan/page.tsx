import { redirect } from "next/navigation";

export default function ScanPage() {
    redirect("/pay?mode=qr");
}
