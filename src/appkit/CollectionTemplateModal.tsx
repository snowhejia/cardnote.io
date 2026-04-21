import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { SchemaField, SchemaFieldType } from "../types";
import { useAppUiLang } from "../appUiLang";
import { useAppChrome } from "../i18n/useAppChrome";

export type CollectionTemplateDialogState = {
  collectionId: string;
  displayName: string;
};

type Props = {
  dialog: CollectionTemplateDialogState | null;
  initialFields: SchemaField[];
  onClose: () => void;
  onConfirm: (collectionId: string, fields: SchemaField[]) => void;
};

const FIELD_TYPES: SchemaFieldType[] = [
  "text",
  "number",
  "choice",
  "cardLink",
  "cardLinks",
  "collectionLink",
  "date",
  "checkbox",
  "url",
];

const FIELD_TYPE_LABELS: Record<
  SchemaFieldType,
  { zh: string; en: string }
> = {
  text: { zh: "文本", en: "Text" },
  number: { zh: "数字", en: "Number" },
  choice: { zh: "单选", en: "Choice" },
  cardLink: { zh: "关联单卡", en: "Single card link" },
  cardLinks: { zh: "关联多卡", en: "Multi card links" },
  collectionLink: { zh: "关联合集", en: "Collection link" },
  date: { zh: "日期时间", en: "Date & time" },
  checkbox: { zh: "勾选", en: "Checkbox" },
  url: { zh: "链接", en: "URL" },
};

function createFieldId(index: number) {
  return `sf-u-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

export function CollectionTemplateModal({
  dialog,
  initialFields,
  onClose,
  onConfirm,
}: Props) {
  const { lang } = useAppUiLang();
  const c = useAppChrome();
  const [draft, setDraft] = useState<SchemaField[]>([]);

  useEffect(() => {
    if (!dialog) return;
    const seeded = (initialFields ?? []).map((f, i) => ({
      ...f,
      id: f.id?.trim() || createFieldId(i),
      order: i,
    }));
    setDraft(seeded.length > 0 ? seeded : [{ id: createFieldId(0), name: lang === "en" ? "Title" : "标题", type: "text", order: 0 }]);
  }, [dialog, initialFields, lang]);

  const title = useMemo(
    () =>
      lang === "en"
        ? `Edit template: ${dialog?.displayName ?? ""}`
        : `设置模板：${dialog?.displayName ?? ""}`,
    [dialog?.displayName, lang]
  );

  if (!dialog) return null;

  return createPortal(
    <div className="auth-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="auth-modal collection-template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-template-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="collection-template-modal__head">
          <h3
            className="collection-template-modal__title"
            id="collection-template-modal-title"
          >
            {title}
          </h3>
          <p className="collection-template-modal__sub">
            {lang === "en"
              ? "Edit schema fields for this collection template."
              : "在这里编辑该模板的属性字段。"}
          </p>
        </div>
        <div className="collection-template-modal__fields">
          {draft.map((f, idx) => (
            <div
              key={`${f.id}-${idx}`}
              className="collection-template-modal__field-row"
            >
              <input
                className="auth-modal__input"
                aria-label={lang === "en" ? "Field name" : "属性名"}
                placeholder={lang === "en" ? "Field name" : "属性名称"}
                value={f.name}
                onChange={(e) =>
                  setDraft((prev) => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], name: e.target.value };
                    return next;
                  })
                }
              />
              <select
                className="auth-modal__input"
                aria-label={lang === "en" ? "Field type" : "属性类型"}
                value={f.type}
                onChange={(e) =>
                  setDraft((prev) => {
                    const next = [...prev];
                    next[idx] = {
                      ...next[idx],
                      type: e.target.value as SchemaFieldType,
                    };
                    return next;
                  })
                }
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {lang === "en"
                      ? FIELD_TYPE_LABELS[t].en
                      : FIELD_TYPE_LABELS[t].zh}
                  </option>
                ))}
              </select>
              {draft.length > 1 ? (
                <button
                  type="button"
                  className="note-settings-modal__custom-type-remove-field"
                  aria-label={lang === "en" ? "Remove field" : "删除属性"}
                  onClick={() =>
                    setDraft((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  −
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="auth-modal__btn collection-template-modal__add-btn"
          onClick={() =>
            setDraft((prev) => [
              ...prev,
              {
                id: createFieldId(prev.length),
                name: "",
                type: "text",
                order: prev.length,
              },
            ])
          }
        >
          {lang === "en" ? "Add field" : "新增属性"}
        </button>
        <div className="collection-template-modal__actions">
          <button type="button" className="auth-modal__btn" onClick={onClose}>
            {lang === "en" ? "Cancel" : "取消"}
          </button>
          <button
            type="button"
            className="auth-modal__btn auth-modal__btn--primary"
            onClick={() => {
              const fields = draft
                .map((f, idx) => ({
                  ...f,
                  id: f.id?.trim() || createFieldId(idx),
                  name: f.name.trim(),
                  order: idx,
                }))
                .filter((f) => f.name);
              onConfirm(dialog.collectionId, fields);
            }}
          >
            {c.done}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

