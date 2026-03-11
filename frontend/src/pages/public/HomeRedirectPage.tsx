import { Navigate } from "react-router-dom";

export default function HomeRedirectPage() {
  // アクセスされたら、すべての判定ロジックを集約した /reservations へ転送
  return <Navigate to="/reservations" replace />;
}