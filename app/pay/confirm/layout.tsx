"use client";

import { WalletProvider } from "@/contexts/wallet-context";

export default function ConfirmLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  // this is componets from walet-provide
  return <WalletProvider>{children}</WalletProvider>;
}

