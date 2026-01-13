type Props = {
  title: string;
};

export default function SimplePageHeader({ title }: Props) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        padding: "12px",
        borderBottom: "1px solid #eee",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "#222",
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
    </div>
  );
}
