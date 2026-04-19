import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <section className="admin-shell">{children}</section>;
}
