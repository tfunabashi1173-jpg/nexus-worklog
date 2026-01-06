import { ReactNode } from "react";

export default function LogArea({ children }: { children?: ReactNode }) {
  return <div className="min-h-[40px]">{children}</div>;
}
