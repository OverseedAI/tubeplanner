"use client";

import { useState, useEffect, useCallback } from "react";

export function useApiKey() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkKey = useCallback(async () => {
    try {
      const response = await fetch("/api/user/api-key");
      if (response.ok) {
        const data = await response.json();
        setHasKey(data.hasKey);
      }
    } catch (error) {
      console.error("Failed to check API key:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkKey();
  }, [checkKey]);

  const refresh = useCallback(() => {
    setHasKey(true);
  }, []);

  return { hasKey, loading, refresh };
}
