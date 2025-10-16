import { createContext, useContext } from "react";

export const AdminContext = createContext({
  message: "",
  setMessage: () => {},
  logout: () => {},
  profile: null,
});

export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdminContext는 AdminContext.Provider 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
