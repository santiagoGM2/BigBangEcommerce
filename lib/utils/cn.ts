import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Compone clases de Tailwind resolviendo conflictos (bg-red-500 + bg-blue-500 -> bg-blue-500). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
