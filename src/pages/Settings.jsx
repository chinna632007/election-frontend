/**
 * Settings — Customization Center (admin). Every knob the authority can
 * change without code lives here, backed by GET/PATCH /api/settings.
 * See backend docs/CUSTOMIZATION_ROADMAP.md §2 for the registry pattern.
 */

import { useEffect, useState } from "react";
import "./Phase1.css";
import "./Training.css";
import Header from "../components/Header.jsx";
import { useAuth } from "../api/auth-context.js";
import {
  listSettings,
  updateSetting,
  listSettingChanges,
  listUsers,
  deleteUser,
} from "../api/client.js";

function SettingField({ setting, disabled, onSave }) {
  const [draft, setDraft] = useState(setting.value);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  function coerce(raw) {
    if (setting.type === "number") {
      if (raw === "" || raw == null) return raw;
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    if (setting.type === "boolean") return raw === true || raw === "true";
    return raw;
  }

  async function handleSave() {
    const value = coerce(draft);
    if (setting.type === "number" && (value === "" || value == null || !Number.isFinite(value))) return;
    setSaving(true);
    try {
      await onSave(setting.key, value);
      setDraft(value);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(setting.value);

  return (
    <div className="tr-setting-row">
      <div className="tr-setting-meta">
        <span className="tr-setting-label">{setting.label}</span>
        <code className="tr-setting-key">{setting.key}</code>
      </div>
      <div className="tr-setting-control">
        {setting.type === "boolean" ? (
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(draft)}
            aria-label={setting.label}
            className={"p1-mini-btn" + (draft ? " is-active" : "")}
            disabled={disabled || saving}
            onClick={() => setDraft(!draft)}
          >
            {draft ? "On" : "Off"}
          </button>
        ) : (
          <input
            type={setting.type === "number" ? "number" : "text"}
            className="tr-setting-input"
            aria-label={setting.label}
            value={draft ?? ""}
            disabled={disabled || saving}
            onChange={(e) => setDraft(setting.type === "number" ? e.target.valueAsNumber : e.target.value)}
          />
        )}
        <button
          type="button"
          className="p1-mini-btn"
          disabled={disabled || saving || !dirty}
          onClick={handleSave}
        >
          {saving ? "Saving…" : savedTick ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}


const GROUP_TITLES = {
  election: "Election rules",
  uploads: "Upload limits",
  training: "Training",
  notifications: "Notifications",
  portal: "Portal branding & text",
};

export default function Settings() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isMunicipal = path.startsWith("/elections/municipal");
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  const [settings, setSettings] = useState([]);
  const [changes, setChanges] = useState([]);
  const [changesVisible, setChangesVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState(null);
  const [userSuccessMsg, setUserSuccessMsg] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const fetchUsers = async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const data = await listUsers();
      setUsersList(data.users || []);
      setUserError(null);
    } catch (e) {
      setUserError(e.message || "Failed to load user list");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  async function handleDeleteUserConfirm() {
    if (!confirmDeleteUser) return;
    setDeletingUserId(confirmDeleteUser.id);
    setUserError(null);
    setUserSuccessMsg(null);
    try {
      await deleteUser(confirmDeleteUser.id);
      setUserSuccessMsg(`User "${confirmDeleteUser.username}" and all associated election records successfully removed.`);
      setConfirmDeleteUser(null);
      await fetchUsers();
      setTimeout(() => setUserSuccessMsg(null), 4000);
    } catch (e) {
      setUserError(e.message || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listSettings();
        if (cancelled) return;
        setSettings(data.settings || []);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(key, value) {
    setFormError(null);
    try {
      const data = await updateSetting(key, value);
      setSettings((prev) => prev.map((s) => (s.key === key ? data.setting : s)));
    } catch (e) {
      if (e && e.status === 403) {
        setFormError("Your role cannot edit settings (authority/admin only).");
      } else {
        setFormError(e.message || "Failed to save " + key);
      }
      throw e;
    }
  }

  async function toggleChanges() {
    if (changesVisible) {
      setChangesVisible(false);
      return;
    }
    try {
      const data = await listSettingChanges(20);
      setChanges(data.changes || []);
      setChangesVisible(true);
      setFormError(null);
    } catch (e) {
      if (e && e.status === 403) {
        setFormError("Change history is visible to authority/admin only.");
      } else {
        setFormError(e.message || "Failed to load change history");
      }
    }
  }

  const groups = {};
  for (const s of settings) {
    (groups[s.group] = groups[s.group] || []).push(s);
  }
  const groupNames = Object.keys(groups).sort();

  return (
    <div className="p1-page">
      <div className="page-overlay" />
      <Header />
      <main className="p1-main">
        <div className="tr-back-row">
          <a className="p1-back-btn" href={backHref}>
            ← Back
          </a>
          <h1 className="p1-title">Settings — Customization Center</h1>
        </div>
        <p className="tr-hint">
          Every value here takes effect immediately. Defaults match the
          original behavior — changing nothing keeps everything as it was.
        </p>

        {loading && <div className="tr-empty">Loading settings…</div>}
        {error && (
          <div className="p1-alert p1-alert-error" role="alert">
            {error}
          </div>
        )}
        {formError && (
          <div className="p1-alert p1-alert-error" role="alert">
            {formError}
          </div>
        )}

        {!loading && !error && groupNames.length === 0 && (
          <div className="tr-empty">No settings available for your role.</div>
        )}

        {groupNames.map((g) => (
          <section className="tr-panel" key={g}>
            <div className="tr-panel-head">
              <span className="tr-label">{GROUP_TITLES[g] || g}</span>
            </div>
            {groups[g].map((s) => (
              <SettingField key={s.key} setting={s} disabled={false} onSave={handleSave} />
            ))}
          </section>
        ))}

        <section className="tr-panel">
          <div className="tr-panel-head">
            <span className="tr-label">Change history</span>
            <button type="button" className="p1-mini-btn" onClick={toggleChanges}>
              {changesVisible ? "Hide" : "Show last 20 changes"}
            </button>
          </div>
          {changesVisible && changes.length === 0 && (
            <div className="tr-empty">No changes recorded yet.</div>
          )}
          {changesVisible &&
            changes.map((c, i) => (
              <div className="tr-setting-row" key={(c.key || "") + "-" + i}>
                <div className="tr-setting-meta">
                  <code className="tr-setting-key">{c.key}</code>
                  <span className="tr-hint">
                    {JSON.stringify(c.oldValue)} → {JSON.stringify(c.newValue)}
                  </span>
                </div>
                <span className="tr-hint">
                  {c.changedAt ? new Date(c.changedAt).toLocaleString("en-IN") : "—"}
                </span>
              </div>
            ))}
        </section>

        {isAdmin && (
          <section className="tr-panel" style={{ marginTop: 24, border: "1px solid #fed7aa", background: "#fffdf9" }}>
            <div className="tr-panel-head">
              <span className="tr-label" style={{ color: "#9a3412" }}>
                User Accounts &amp; Data Administration
              </span>
              <button
                type="button"
                className="p1-mini-btn"
                onClick={fetchUsers}
                disabled={loadingUsers}
              >
                {loadingUsers ? "Refreshing…" : "Refresh Users"}
              </button>
            </div>
            <p className="tr-hint" style={{ marginBottom: 16 }}>
              Administrator panel for managing system user accounts. Deleting a user safely cascades to remove or anonymize all associated import batches, polling stations, training records, and audit entries.
            </p>

            {userSuccessMsg && (
              <div className="p1-alert p1-alert-success" style={{ marginBottom: 14 }}>
                {userSuccessMsg}
              </div>
            )}
            {userError && (
              <div className="p1-alert p1-alert-error" style={{ marginBottom: 14 }}>
                {userError}
              </div>
            )}

            {/* Confirmation dialog */}
            {confirmDeleteUser && (
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 800, color: "#9f1239", fontSize: 15, marginBottom: 6 }}>
                  Confirm Permanent User Deletion
                </div>
                <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px 0", lineHeight: 1.45 }}>
                  Are you sure you want to delete user <strong>"{confirmDeleteUser.username}"</strong> ({confirmDeleteUser.role})?
                  <br />
                  This will remove this user's account and permanently delete or anonymize all associated records
                  ({confirmDeleteUser.batchCount || 0} import batches, {confirmDeleteUser.stationCount || 0} polling stations, and {confirmDeleteUser.sessionCount || 0} training sessions).
                  <br />
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>This action cannot be undone.</span>
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    className="p1-mini-btn"
                    style={{ background: "#dc2626", color: "#fff", borderColor: "#b91c1c" }}
                    onClick={handleDeleteUserConfirm}
                    disabled={Boolean(deletingUserId)}
                  >
                    {deletingUserId ? "Deleting User & Records…" : "Yes, Delete User and Data"}
                  </button>
                  <button
                    type="button"
                    className="p1-mini-btn"
                    onClick={() => setConfirmDeleteUser(null)}
                    disabled={Boolean(deletingUserId)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loadingUsers && <div className="tr-empty">Loading active users from MongoDB…</div>}

            {!loadingUsers && usersList.length === 0 && (
              <div className="tr-empty">No user accounts found in MongoDB.</div>
            )}

            {!loadingUsers && usersList.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="p1-table" style={{ width: "100%", minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>ID</th>
                      <th>Username</th>
                      <th style={{ width: 120 }}>Role</th>
                      <th style={{ width: 180 }}>Associated Data</th>
                      <th style={{ width: 120, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => {
                      const isSelf = String(u.id) === String(user?.id);
                      return (
                        <tr key={u.id}>
                          <td className="p1-mono">{u.id}</td>
                          <td>
                            <strong>{u.username}</strong>
                            {isSelf && (
                              <span style={{ marginLeft: 6, fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                                Current User
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                textTransform: "capitalize",
                                fontWeight: 700,
                                fontSize: 12,
                                padding: "3px 8px",
                                borderRadius: 6,
                                background: u.role === "admin" ? "#fef3c7" : u.role === "authority" ? "#e0e7ff" : "#f1f5f9",
                                color: u.role === "admin" ? "#92400e" : u.role === "authority" ? "#3730a3" : "#475569",
                              }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: "#64748b" }}>
                            {u.batchCount || 0} batches · {u.stationCount || 0} stations · {u.sessionCount || 0} sessions
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="p1-mini-btn"
                              style={{
                                color: isSelf ? "#94a3b8" : "#dc2626",
                                borderColor: isSelf ? "#e2e8f0" : "#fca5a5",
                                background: isSelf ? "#f8fafc" : "#fff",
                                cursor: isSelf ? "not-allowed" : "pointer",
                              }}
                              disabled={isSelf || Boolean(deletingUserId)}
                              title={isSelf ? "You cannot delete your own active account" : `Delete ${u.username}`}
                              onClick={() => setConfirmDeleteUser(u)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Navigation Actions (Back and Continue) */}
        <div className="p1-nav-bar">
          <a className="p1-nav-back-btn" href={`${backHref}/training`}>
            ← Back to Training Schedule
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
