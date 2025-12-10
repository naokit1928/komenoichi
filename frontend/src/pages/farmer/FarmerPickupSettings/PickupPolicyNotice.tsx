// frontend/src/features/farmer-pickup/PickupPolicyNotice.tsx
import React from "react";

type Props = {
  /** 本人登録ページなどでチェックボックスを表示するかどうか */
  withCheckbox?: boolean;
  /** withCheckbox=true のときのチェック状態 */
  checked?: boolean;
  /** withCheckbox=true のときに変更を親へ通知 */
  onChangeChecked?: (v: boolean) => void;
  className?: string;
};

/**
 * 受け渡し場所に関する共通ルール表示コンポーネント
 *
 * - 「自宅／自分の管理する敷地内での販売」に限定するための注意書き
 * - 新規登録ページと受け渡し場所設定ページの両方で利用する想定
 */
const PickupPolicyNotice: React.FC<Props> = ({
  withCheckbox = false,
  checked = false,
  onChangeChecked,
  className = "",
}) => {
  return (
    <div
      className={
        "rounded-xl bg-gray-50 border border-dashed border-gray-300 px-3 py-3 " +
        className
      }
    >
      <p className="text-[11px] leading-relaxed text-gray-700 mb-1">
        受け渡し場所は、原則として
        <span className="font-semibold">
          自宅または自分が管理する屋根付きの敷地内
        </span>
        に限られます。
      </p>
      <ul className="list-disc pl-4 text-[11px] leading-relaxed text-gray-600 space-y-0.5 mb-2">
        <li>米屋・スーパーなどの小売店や商社倉庫、公園・公共施設などは登録できません。</li>
        <li>やむを得ず自宅以外で受け渡しを行いたい場合は、事前に運営と相談してください。</li>
      </ul>

      {withCheckbox && (
        <label className="flex items-center gap-2 text-[11px] text-gray-700">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-gray-300"
            checked={!!checked}
            onChange={(e) => onChangeChecked?.(e.target.checked)}
          />
          <span>上記のルールを理解し、自分の管理する敷地内のみで販売します。</span>
        </label>
      )}
    </div>
  );
};

export default PickupPolicyNotice;
