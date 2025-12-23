import React from "react";

export default function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* 下に余白を追加 */}
      <div className="mx-auto max-w-md px-4 pt-6 pb-24">
        {children}
      </div>
    </div>
  );
}
