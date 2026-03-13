import React from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { FarmerBottomBar, BOTTOM_TAB_HEIGHT } from "@/components/FarmerBottomBar";

export default function FarmerLayout() {
  const context = useOutletContext();

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#F7F7F7",
        paddingBottom: BOTTOM_TAB_HEIGHT,
      }}
    >
      <Outlet context={context} />
      <FarmerBottomBar /> {/* コンポーネント化 */}
    </div>
  );
}