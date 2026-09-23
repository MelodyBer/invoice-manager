"use client";
import { useEffect } from "react";

/** A tiny client island so the print dialog opens automatically once the printable report has rendered. */
export function PrintOnLoad(): null {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);
  return null;
}
