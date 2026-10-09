import { redirect } from "next/navigation";

// 旧合作记录页已升级为合作工单系统，保留数据，仅重定向入口
export default function CooperationsRedirect() {
  redirect("/tickets");
}
