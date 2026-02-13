import { redirect } from "next/navigation";

export default function NFCPayPage() {
    redirect("/pay?mode=nfc");
}
