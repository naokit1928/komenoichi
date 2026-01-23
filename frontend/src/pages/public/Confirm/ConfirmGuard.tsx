import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "@/config/api";
import ActiveReservationGuardCard from "../FarmDetail/components/ActiveReservationGuardCard";

export default function ConfirmGuard({ children }: { children: JSX.Element }) {
  const navigate = useNavigate();
  const { farmId } = useParams();
  const [active, setActive] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/reservations/latest`, {
          credentials: "include",
        });
        setActive(res.ok);
      } catch {
        setActive(false);
      }
    })();
  }, []);

  if (active === null) return null; // loading

  if (active) {
    return (
      <div style={{ maxWidth: 520, margin: "32px auto", padding: "0 16px" }}>
        <ActiveReservationGuardCard
          onGoBooked={() => navigate("/reservation/booked")}
        />
      </div>
    );
  }

  return children;
}
