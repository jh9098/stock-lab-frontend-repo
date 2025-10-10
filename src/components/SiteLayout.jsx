import { Outlet } from "react-router-dom";
import MainNavigation from "./MainNavigation";

export default function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
      <MainNavigation />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
