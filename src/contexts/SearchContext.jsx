import { createContext, useContext } from "react";

export const SearchContext = createContext(null);

export function useSearchContext() {
  return useContext(SearchContext);
}