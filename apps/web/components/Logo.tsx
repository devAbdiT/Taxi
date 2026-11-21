import Image from "next/image";

export function Logo({
  className = "h-12",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <Image
        src="/logo.png"
        alt="MengedLink"
        width={638}
        height={323}
        priority={priority}
        className="h-full w-auto"
        style={{ height: "100%", width: "auto" }}
      />
    </span>
  );
}
