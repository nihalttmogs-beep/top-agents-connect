const KEY = "topagents_session";
export const isLoggedIn = () => typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
export const login = (u: string, p: string) => {
  if (u.trim() === "jannahtool" && p === "bebebooboo") {
    localStorage.setItem(KEY, "1");
    return true;
  }
  return false;
};
