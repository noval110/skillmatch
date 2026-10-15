import { UserRound } from "lucide-react";

export default function Avatar({
  name = "",
  className = "",
  size = "medium",
  src = "",
}) {
  return (
    <span
      className={`avatar ${src ? "avatar-image" : "avatar-placeholder"} avatar-${size} ${className}`}
      title={name}
    >
      {src ? <img src={src} alt="" /> : <UserRound aria-hidden="true" strokeWidth={1.5} />}
      <span className="sr-only">{name}</span>
    </span>
  );
}
