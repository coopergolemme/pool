"use client";

import { useState, useEffect } from "react";
import { checkPushPermission, registerPush } from "../lib/push";
import { Button } from "./ui/Button";
import { toast } from "sonner";

interface PushManagerProps {
  userId: string | null;
}

export function PushManager({ userId }: PushManagerProps) {
  const [permission, setPermission] = useState<string>("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPushPermission().then(setPermission);
  }, []);

  if (!userId || permission === "granted" || permission === "unsupported") return null;

  async function handleEnable() {
    setLoading(true);
    const success = await registerPush(userId!);
    if (success) {
      setPermission("granted");
      toast.success("Notifications enabled! 🔔");
    } else {
      toast.error("Failed to enable notifications.");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-5 backdrop-blur sm:p-6 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-blue-200">Stay Updated</h4>
          <p className="text-sm text-white/50">Get notified when someone challenges you or verifies a win.</p>
        </div>
        <Button 
          variant="primary" 
          onClick={handleEnable} 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          {loading ? "Enabling..." : "Enable Notifications"}
        </Button>
      </div>
    </div>
  );
}
