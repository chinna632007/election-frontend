
/**
 * Fields — Data-schema customization center (admin).
 * Admins define FIELDS, never SQL.
 * Core fields cannot be deactivated.
 */

import { useEffect, useState } from "react";
import "./Training.css";
import Header from "../components/Header.jsx";
import {
  listFields,
  createField,
  updateField,
  deactivateField,
} from "../api/client.js";

const DATA_TYPE_LABELS = {
  string: "Text",
  number: "Number",
  date: "Date",
  boolean: "Yes/No",
  enum: "Choice list",
};

const DATA_TYPES = Object.keys(DATA_TYPE_LABELS);

function parseEnumOptions(value) {
  return value
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

function FieldRow({
  field,
  disabled,
  onUpdate,
  onDeactivate,
  onMove,
}) {
  const [label, setLabel] = useState(field.label ?? "");
  const [dataType, setDataType] = useState(field.dataType ?? "string");
  const [importColumn, setImportColumn] = useState(
    field.importColumn ?? ""
  );
  const [enumStr, setEnumStr] = useState(
    (field.enumOptions ?? []).join(", ")
  );
  const [saving, setSaving] = useState(false);

  // Initial field values are captured by useState(field.label ?? "") etc.
  // This effect is intentionally left empty; state is seeded at declaration.

  async function save() {
    if (!label.trim()) {
      alert("Please enter a field label.");
      return;
    }

    const enumOptions =
      dataType === "enum" ? parseEnumOptions(enumStr) : null;

    if (dataType === "enum" && enumOptions.length === 0) {
      alert("Please enter at least one choice-list option.");
      return;
    }

    setSaving(true);

    try {
      const data = await updateField(field.id, {
        label: label.trim(),
        dataType,
        isRequired: field.isRequired,
        isSensitive: field.isSensitive,
        exportVisible: field.exportVisible,
        importColumn: importColumn.trim(),
        sortOrder: field.sortOrder,
        enumOptions,
      });

      onUpdate(data.field);
    } catch (error) {
      alert(error.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tr-field-row">
      <span className="tr-field-handle" title="Field order">
        ⋮⋮
      </span>

      <code className="tr-field-key">{field.fieldKey}</code>

      <span
        className={`tr-field-badge ${
          field.isCore
            ? "tr-field-badge-core"
            : "tr-field-badge-custom"
        }`}
      >
        {field.isCore ? "CORE" : "CUSTOM"}
      </span>

      <input
        className="tr-field-input"
        aria-label="Field label"
        value={label}
        disabled={disabled || saving}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Field label"
      />

      <select
        className="tr-field-input"
        aria-label="Data type"
        disabled={disabled || saving}
        value={dataType}
        onChange={(event) => setDataType(event.target.value)}
      >
        {DATA_TYPES.map((type) => (
          <option key={type} value={type}>
            {DATA_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      <input
        className="tr-field-input"
        aria-label="Excel import column"
        value={importColumn}
        disabled={disabled || saving}
        onChange={(event) => setImportColumn(event.target.value)}
        placeholder="Excel header"
      />

      {dataType === "enum" && (
        <input
          className="tr-field-input"
          aria-label="Choice-list options"
          value={enumStr}
          disabled={disabled || saving}
          onChange={(event) => setEnumStr(event.target.value)}
          placeholder="Option A, Option B"
        />
      )}

      <button
        type="button"
        className="p1-mini-btn"
        disabled={disabled || saving}
        onClick={save}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <button
        type="button"
        className="p1-mini-btn p1-mini-btn--outline"
        disabled={disabled || saving || field.isCore}
        onClick={() => onDeactivate(field)}
      >
        {field.isCore ? "Locked" : "Deactivate"}
      </button>

      <button
        type="button"
        className="p1-mini-btn"
        disabled={disabled || saving || field.sortOrder <= 1}
        onClick={() => onMove(field.id, -1)}
        aria-label={`Move ${field.fieldKey} up`}
      >
        ↑
      </button>

      <button
        type="button"
        className="p1-mini-btn"
        disabled={disabled || saving}
        onClick={() => onMove(field.id, 1)}
        aria-label={`Move ${field.fieldKey} down`}
      >
        ↓
      </button>
    </div>
  );
}

export default function Fields({ entity }) {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isMunicipal = path.startsWith("/elections/municipal");
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [addField, setAddField] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("string");
  const [newImportColumn, setNewImportColumn] = useState("");
  const [newEnumStr, setNewEnumStr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await listFields(entity);

        if (cancelled) return;

        setFields(
          [...response.fields].sort(
            (a, b) => a.sortOrder - b.sortOrder
          )
        );
      } catch (error) {
        if (!cancelled) {
          setError(error.message || "Failed to load fields.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [entity]);

  async function handleCreate() {
    const fieldKey = newKey.trim();
    const label = newLabel.trim();
    const importColumn = newImportColumn.trim();

    if (!/^[a-z][a-z0-9_]*$/.test(fieldKey)) {
      alert(
        "Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores."
      );
      return;
    }

    if (!label) {
      alert("Please enter a field label.");
      return;
    }

    const enumOptions =
      newType === "enum" ? parseEnumOptions(newEnumStr) : null;

    if (newType === "enum" && enumOptions.length === 0) {
      alert("Please enter at least one choice-list option.");
      return;
    }

    setCreating(true);

    try {
      const response = await createField(entity, {
        fieldKey,
        label,
        dataType: newType,
        importColumn: importColumn || fieldKey,
        isRequired: false,
        isSensitive: false,
        exportVisible: true,
        enumOptions,
      });

      setFields((previous) =>
        [...previous, response.field].sort(
          (a, b) => a.sortOrder - b.sortOrder
        )
      );

      setNewKey("");
      setNewLabel("");
      setNewType("string");
      setNewImportColumn("");
      setNewEnumStr("");
      setAddField(false);
    } catch (error) {
      alert(error.message || "Create failed.");
    } finally {
      setCreating(false);
    }
  }

  function handleUpdate(updatedField) {
    setFields((previous) =>
      previous
        .map((field) =>
          field.id === updatedField.id ? updatedField : field
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
  }

  async function handleDeactivate(field) {
    if (field.isCore) return;

    const confirmed = window.confirm(
      `Deactivate "${field.fieldKey}"? Existing data will be retained, but the field will no longer appear in active forms.`
    );

    if (!confirmed) return;

    try {
      const response = await deactivateField(field.id);

      setFields((previous) =>
        previous.filter(
          (item) => item.id !== response.field.id
        )
      );
    } catch (error) {
      alert(error.message || "Deactivate failed.");
    }
  }

  async function handleMove(fieldId, direction) {
    if (savingOrder) return;

    const sorted = [...fields].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    const index = sorted.findIndex(
      (field) => field.id === fieldId
    );
    const targetIndex = index + direction;

    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= sorted.length
    ) {
      return;
    }

    const reordered = [...sorted];

    [reordered[index], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[index],
    ];

    const updatedOrder = reordered.map((field, index) => ({
      ...field,
      sortOrder: index + 1,
    }));

    const previousFields = fields;

    setFields(updatedOrder);
    setSavingOrder(true);

    try {
      await Promise.all(
        updatedOrder.map((field) =>
          updateField(field.id, {
            label: field.label,
            dataType: field.dataType,
            isRequired: field.isRequired,
            isSensitive: field.isSensitive,
            exportVisible: field.exportVisible,
            importColumn: field.importColumn ?? "",
            sortOrder: field.sortOrder,
            enumOptions:
              field.dataType === "enum"
                ? field.enumOptions ?? []
                : null,
          })
        )
      );
    } catch (error) {
      setFields(previousFields);
      alert(
        error.message ||
          "Failed to save field order. The previous order has been restored."
      );
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div>
      <Header
        title={`${
          entity === "personnel"
            ? "Personnel"
            : "Polling Station"
        } fields`}
      />

      <main className="tr-main">
        <div className="tr-panel">
          <div className="tr-panel-head">
            <span className="tr-label">Custom fields</span>

            <button
              type="button"
              className="p1-mini-btn"
              disabled={loading || Boolean(error) || savingOrder}
              onClick={() => setAddField((previous) => !previous)}
            >
              {addField ? "Cancel" : "Add field"}
            </button>
          </div>

          {error && <div className="tr-error">{error}</div>}

          {loading ? (
            <div className="tr-empty">Loading…</div>
          ) : error ? (
            <div className="tr-empty">
              Unable to load fields. Please try again.
            </div>
          ) : fields.length === 0 ? (
            <div className="tr-empty">No fields yet.</div>
          ) : (
            <div>
              {fields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  disabled={savingOrder}
                  onUpdate={handleUpdate}
                  onDeactivate={handleDeactivate}
                  onMove={handleMove}
                />
              ))}
            </div>
          )}

          {savingOrder && (
            <div className="tr-empty">Saving field order…</div>
          )}
        </div>

        {addField && (
          <div className="tr-panel">
            <div className="tr-panel-head">
              <span className="tr-label">New custom field</span>
            </div>

            <div className="tr-panel-body">
              <div className="tr-field">
                <label className="tr-label" htmlFor="new-field-key">
                  Field key (snake_case)
                </label>

                <input
                  id="new-field-key"
                  className="tr-input"
                  value={newKey}
                  disabled={creating}
                  onChange={(event) =>
                    setNewKey(
                      event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "_")
                    )
                  }
                  placeholder="e.g. blood_group"
                />
              </div>

              <div className="tr-field">
                <label className="tr-label" htmlFor="new-field-label">
                  Label
                </label>

                <input
                  id="new-field-label"
                  className="tr-input"
                  value={newLabel}
                  disabled={creating}
                  onChange={(event) =>
                    setNewLabel(event.target.value)
                  }
                  placeholder="e.g. Blood group"
                />
              </div>

              <div className="tr-field">
                <label className="tr-label" htmlFor="new-field-type">
                  Data type
                </label>

                <select
                  id="new-field-type"
                  className="tr-input"
                  value={newType}
                  disabled={creating}
                  onChange={(event) =>
                    setNewType(event.target.value)
                  }
                >
                  {DATA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DATA_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tr-field">
                <label
                  className="tr-label"
                  htmlFor="new-field-import-column"
                >
                  Import column (Excel header)
                </label>

                <input
                  id="new-field-import-column"
                  className="tr-input"
                  value={newImportColumn}
                  disabled={creating}
                  onChange={(event) =>
                    setNewImportColumn(event.target.value)
                  }
                  placeholder="e.g. Blood Group"
                />
              </div>

              {newType === "enum" && (
                <div className="tr-field">
                  <label
                    className="tr-label"
                    htmlFor="new-field-options"
                  >
                    Choice-list options (comma-separated)
                  </label>

                  <input
                    id="new-field-options"
                    className="tr-input"
                    value={newEnumStr}
                    disabled={creating}
                    onChange={(event) =>
                      setNewEnumStr(event.target.value)
                    }
                    placeholder="A+, B+, AB+, O+"
                  />
                </div>
              )}

              <button
                type="button"
                className="p1-mini-btn"
                disabled={creating || !newKey.trim() || !newLabel.trim()}
                onClick={handleCreate}
              >
                {creating ? "Creating…" : "Create field"}
              </button>
            </div>
          </div>
        )}

        {/* Navigation Actions (Back and Continue) */}
        <div className="p1-nav-bar">
          <a className="p1-nav-back-btn" href={`${backHref}/settings`}>
            ← Back to Settings
          </a>
          <a
            className="p1-nav-continue-btn"
            href={backHref}
          >
            Return to Election Overview →
          </a>
        </div>
      </main>
    </div>
  );
}
