"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut className="mr-1 h-4 w-4" />
      退出
    </Button>
  );
}
