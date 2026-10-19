import Image from "next/image";

/** Shared decorative mark; the adjacent product name provides its accessible text. */
export function BrandLogo() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Image src="/brand-mark.svg" alt="" width={24} height={24} />
    </span>
  );
}
