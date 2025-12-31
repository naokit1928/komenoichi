import React from "react";

type Props = {
  title?: string;
  className?: string;
};

const FarmerSettingsHeader: React.FC<Props> = ({
  title = "公開用プロフィール設定",
  className = "",
}) => {
  return (
    <header
      className={className}
      style={{
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          maxWidth: "48rem",
          margin: "0 auto",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
        }}
      >
        <h1
          title={title}
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: ".01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            margin: 0,
          }}
        >
          {title}
        </h1>
      </div>
    </header>
  );
};

export default FarmerSettingsHeader;
