"use client";

import { useEffect, useState } from "react";

export function useCameraAvailable(): boolean {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkCamera(): Promise<void> {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some((device) => device.kind === "videoinput");
        if (isMounted) {
          setIsAvailable(hasCamera);
        }
      } catch {
        if (isMounted) {
          setIsAvailable(false);
        }
      }
    }

    void checkCamera();

    return () => {
      isMounted = false;
    };
  }, []);

  return isAvailable;
}
