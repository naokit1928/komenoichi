// src/pages/public/LineCallback/LineCallbackPage.tsx

// 将来:
// URLのクエリ(paramやcode)をFastAPIにPOSTしてline_user_idを確定
// 成功したら /farms/:farmId/confirm に window.location.replace()
// などを行う。

export default function LineCallbackPage() {
  return (
    <section className="space-y-4 text-center">
      <h1 className="text-lg font-semibold text-gray-900">LINE連携中...</h1>
      <p className="text-xs text-gray-600 leading-relaxed">
        少々お待ちください。アカウントを確認しています。
        連携が完了すると確認画面へ移動します。
      </p>
    </section>
  );
}
