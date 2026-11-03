import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ChatClient from "./ChatClient";

export default async function ChatPage() {
  if (!(await cookies()).get("nexa_access")) redirect("/signin");
  return <ChatClient />;
}
