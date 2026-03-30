"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
}

export function ImageWithFallback({ fallbackClassName, className, alt, ...props }: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-[var(--muted)] ${fallbackClassName || className || ""}`}>
        <ImageOff className="h-8 w-8 text-[var(--muted-foreground)]" />
      </div>
    );
  }

  return (
    <img
      {...props}
      alt={alt || ""}
      className={className}
      onError={() => setError(true)}
    />
  );
}
