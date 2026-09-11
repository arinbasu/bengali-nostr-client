import { useContext } from "react";
import { AccountContext } from "./AccountContext";

export function useAccount() {
  return useContext(AccountContext);
}