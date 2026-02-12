"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Coins,
  ClipboardList,
  Megaphone,
  Settings,
  ScrollText,
  Activity,
  Menu,
  X,
  LogOut,
  Trophy,
  CheckSquare,
  Clock,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@safetywallet/ui";
import { useAuthStore } from "@/stores/auth";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/posts", label: "제보 관리", icon: FileText },
  { href: "/members", label: "회원 관리", icon: Users },
  { href: "/attendance", label: "출근 현황", icon: Clock },
  { href: "/points", label: "포인트 관리", icon: Coins },
  { href: "/approvals", label: "승인 관리", icon: CheckSquare },
  { href: "/actions", label: "조치 현황", icon: ClipboardList },
  { href: "/announcements", label: "공지사항", icon: Megaphone },
  { href: "/education", label: "안전교육", icon: GraduationCap },
  { href: "/votes/candidates", label: "투표 후보 관리", icon: Trophy },
  { href: "/settings", label: "설정", icon: Settings },
  { href: "/monitoring", label: "운영 모니터링", icon: Activity },
  { href: "/audit", label: "감사 로그", icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside
      className={cn(
        "flex flex-col bg-slate-900 text-white transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-700 px-4">
        {!collapsed && (
          <span className="text-lg font-bold">안전지갑 관리자</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-white hover:bg-slate-800"
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href) ?? false;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
              )}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white",
            collapsed && "justify-center",
          )}
          onClick={logout}
        >
          <LogOut size={20} />
          {!collapsed && <span>로그아웃</span>}
        </Button>
      </div>
    </aside>
  );
}
