import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface PetAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  species?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  badge?: React.ReactNode;
}

const sizeClasses = {
  xs: "h-7 w-7 text-[11px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-18 w-18 text-xl",
};

export function PetAvatar({
  photoUrl,
  name,
  species,
  size = "md",
  className,
  badge,
}: PetAvatarProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [photoUrl]);

  const isCat = (species || "").toLowerCase().includes("gato") || (species || "").toLowerCase().includes("felin");
  const fallbackEmoji = isCat ? "🐱" : "🐶";
  const initial = name ? name.trim().charAt(0).toUpperCase() : fallbackEmoji;

  const showImage = Boolean(photoUrl && !imageError);

  return (
    <div className={cn("relative shrink-0 inline-block", className)}>
      {showImage ? (
        <img
          src={photoUrl!}
          alt={name || "Foto do Pet"}
          onError={() => setImageError(true)}
          className={cn(
            "rounded-full object-cover border-2 border-primary/25 shadow-xs bg-slate-100 dark:bg-slate-800",
            sizeClasses[size]
          )}
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "grid place-items-center rounded-full font-extrabold bg-gradient-to-br from-primary/20 via-primary/10 to-amber-500/10 border-2 border-primary/20 text-primary shadow-xs select-none",
            sizeClasses[size]
          )}
        >
          <span>{initial}</span>
        </div>
      )}
      {badge && <div className="absolute -bottom-0.5 -right-0.5">{badge}</div>}
    </div>
  );
}
