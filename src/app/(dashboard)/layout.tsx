import { type ReactNode, Suspense } from "react";
import {
  DashboardChrome,
  DashboardChromeFallback,
} from "@/components/dashboard/dashboard-chrome";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <SidebarProvider>
      <Suspense fallback={<DashboardChromeFallback />}>
        <DashboardChrome>{children}</DashboardChrome>
      </Suspense>
    </SidebarProvider>
  );
}
