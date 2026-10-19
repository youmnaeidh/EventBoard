import { Link } from "react-router-dom";
import { assetUrl } from "../lib/assets";

export function Logo({ height = 40 }: { height?: number }) {
  return (
    <Link to="/" className="logo" aria-label="EventBoard — الصفحة الرئيسية">
      <img src={assetUrl("/assets/branding/logo-tight.webp")} alt="" height={height} style={{ height }} />
    </Link>
  );
}
