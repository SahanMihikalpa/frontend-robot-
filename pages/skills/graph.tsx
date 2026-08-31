import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addSkillPrerequisite,
  getSkillGraph,
  getSkillsAnalytics,
  removeSkillPrerequisite,
} from "../../lib/api";
import {
  getStudentsDetailed,
  getStudentMasteryHistory,
  StudentDetailed,
} from "../../lib/teacher-api";
import { getStoredUser } from "../../lib/session";
import { wouldCreateCycle } from "../../lib/graphLayout";
import SkillGraph from "../../components/SkillGraph";
import InfoBox from "../../components/InfoBox";
import { useToast } from "../../components/ToastProvider";

interface SkillGraphNodeData {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  difficulty_level?: number | null;
  prerequisites: number[];
}

interface SkillGraphEdgeData {
  source: number;
  target: number;
}

export default function SkillDependencyGraphPage() {
  const role = getStoredUser()?.role || "";
  const canEdit = role === "teacher" || role === "admin";
  const toast = useToast();

  const [nodes, setNodes] = useState<SkillGraphNodeData[]>([]);
  const [edges, setEdges] = useState<SkillGraphEdgeData[]>([]);
  const [masteryBySkill, setMasteryBySkill] = useState<
    Record<number, number | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // View mode: class-average (default) or one specific student's real mastery
  const [students, setStudents] = useState<StudentDetailed[]>([]);
  const [viewMode, setViewMode] = useState<"class" | number>("class");
  const [individualStatus, setIndividualStatus] = useState<Record<
    number,
    string
  > | null>(null);
  const [individualLoading, setIndividualLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addChoice, setAddChoice] = useState("");
  const [addError, setAddError] = useState("");
  const [mutating, setMutating] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const [gd, ad, sd] = await Promise.allSettled([
      getSkillGraph(),
      getSkillsAnalytics(),
      getStudentsDetailed(),
    ]);

    if (gd.status === "fulfilled") {
      setNodes(gd.value?.nodes || []);
      setEdges(gd.value?.edges || []);
    } else {
      setError("Failed to load the skill graph");
    }

    if (ad.status === "fulfilled") {
      const rows: any[] = Array.isArray(ad.value) ? ad.value : [];
      const m: Record<number, number | null> = {};
      for (const r of rows) m[r.skill_id] = r.avg_score ?? null;
      setMasteryBySkill(m);
    }

    if (sd.status === "fulfilled") {
      setStudents(sd.value || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function selectViewMode(value: string) {
    if (value === "class") {
      setViewMode("class");
      setIndividualStatus(null);
      return;
    }
    const studentId = Number(value);
    setViewMode(studentId);
    setIndividualStatus({}); // clear any previous student's colors immediately (not_started until loaded)
    setIndividualLoading(true);
    try {
      const history = await getStudentMasteryHistory(studentId);
      const statusMap: Record<number, string> = {};
      for (const sk of history.skills) statusMap[sk.skill_id] = sk.status;
      setIndividualStatus(statusMap);
    } catch {
      toast.error({
        title: "Couldn't load that student's mastery",
        message: "Please try again.",
      });
      setViewMode("class");
      setIndividualStatus(null);
    } finally {
      setIndividualLoading(false);
    }
  }

  const viewingStudent =
    typeof viewMode === "number"
      ? students.find((s) => s.user_id === viewMode)
      : null;

  const nameMap = useMemo(
    () =>
      Object.fromEntries(nodes.map((n) => [n.id, n.name])) as Record<
        number,
        string
      >,
    [nodes],
  );

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.name.localeCompare(b.name)),
    [nodes],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) || null,
    [nodes, selectedId],
  );

  const addOptionsByCategory = useMemo(() => {
    if (!selectedNode) return {} as Record<string, SkillGraphNodeData[]>;
    const existing = new Set(selectedNode.prerequisites);
    const groups: Record<string, SkillGraphNodeData[]> = {};
    for (const n of nodes) {
      if (n.id === selectedNode.id || existing.has(n.id)) continue;
      const cat = n.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(n);
    }
    return groups;
  }, [nodes, selectedNode]);

  function selectSkill(id: number) {
    setSelectedId(id);
    setAddChoice("");
    setAddError("");
  }

  async function handleAdd() {
    if (!selectedNode || !addChoice) return;
    const prereqId = Number(addChoice);
    setAddError("");

    if (wouldCreateCycle(edges, selectedNode.id, prereqId)) {
      setAddError(
        `Adding this would create a circular dependency — ${nameMap[prereqId] || "this skill"} already ` +
          `(directly or indirectly) depends on ${selectedNode.name}.`,
      );
      return;
    }

    setMutating(true);
    try {
      await addSkillPrerequisite(selectedNode.id, prereqId);
      toast.success({
        title: "Prerequisite added",
        message: `${nameMap[prereqId]} → ${selectedNode.name}`,
      });
      setAddChoice("");
      await load();
    } catch (err: any) {
      toast.error({
        title: "Could not add prerequisite",
        message: err?.response?.data?.detail || "Please try again.",
      });
    } finally {
      setMutating(false);
    }
  }

  async function handleRemove(prereqId: number) {
    if (!selectedNode) return;
    setMutating(true);
    try {
      await removeSkillPrerequisite(selectedNode.id, prereqId);
      toast.success({
        title: "Prerequisite removed",
        message: `${nameMap[prereqId] || ""} → ${selectedNode.name}`,
      });
      await load();
    } catch (err: any) {
      toast.error({
        title: "Could not remove prerequisite",
        message: err?.response?.data?.detail || "Please try again.",
      });
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className="skill-graph-page student-dash">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Learning Map</p>
          <h2 className="editorial-title">Dependency Graph</h2>
          <p>
            {viewingStudent
              ? `Node colour shows ${viewingStudent.full_name || viewingStudent.username}'s actual mastery for that skill — the same status shown on their own Mastery tab.`
              : "Visualise which skills must be learned before which. Node colour shows the class-average mastery for that skill, using the same scale as the skill heatmap."}
            {canEdit
              ? " Select a skill to add or remove its prerequisites."
              : " Read-only view."}
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Map</span>
          <strong>{edges.length}</strong>
          <p>prerequisite links</p>
        </div>
      </section>

      <InfoBox title="How to read this graph" accent="var(--accent)">
        <p>
          Each box is a skill. An arrow points from a prerequisite to the skill
          that depends on it — follow the arrows to see what a student needs to
          know first. A skill with no arrows pointing into it has no
          prerequisites (an entry-level skill).
        </p>
        <p>
          Box colour shows mastery for that skill: green means mastered, blue
          near mastery, amber still learning, red struggling, and grey means no
          attempts yet — the same colours used on the{" "}
          <Link href="/teacher/heatmap">skill heatmap</Link>. By default this is
          the class-average; use the <strong>View</strong> dropdown below to
          switch to one specific student's actual mastery instead.
        </p>
        {canEdit && (
          <p style={{ margin: 0 }}>
            Click a skill (in the graph or the dropdown below) to manage its
            prerequisites in the panel on the right. The system will refuse an
            edit that would create a circular dependency.
          </p>
        )}
      </InfoBox>

      {error && <p className="feedback error">{error}</p>}

      <div className="skill-graph-layout">
        <section className="teacher-panel">
          <div className="teacher-panel-header">
            <div>
              <p className="teacher-eyebrow">Diagram</p>
              <h3 className="editorial-title">Prerequisite graph</h3>
            </div>
            <span className="skills-count-pill subtle">
              {nodes.length} skills
            </span>
          </div>

          <div className="field" style={{ maxWidth: 300, marginBottom: 20 }}>
            <label>View</label>
            <select
              value={viewMode === "class" ? "class" : String(viewMode)}
              onChange={(e) => selectViewMode(e.target.value)}
              disabled={individualLoading}
            >
              <option value="class">Class average</option>
              {[...students]
                .sort((a, b) =>
                  (a.full_name || a.username).localeCompare(
                    b.full_name || b.username,
                  ),
                )
                .map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.full_name || s.username}
                  </option>
                ))}
            </select>
          </div>

          {loading ? (
            <div className="empty-state">
              <p className="meta">Loading…</p>
            </div>
          ) : (
            <SkillGraph
              nodes={nodes}
              edges={edges}
              masteryBySkill={masteryBySkill}
              statusBySkill={
                viewingStudent ? (individualStatus ?? {}) : undefined
              }
              selectedId={selectedId}
              onSelectNode={selectSkill}
            />
          )}
        </section>

        <aside className="teacher-panel">
          <p className="teacher-eyebrow">Manage</p>
          <h3
            className="editorial-title"
            style={{ fontSize: 22, margin: "8px 0 20px" }}
          >
            Prerequisites
          </h3>

          <div className="field">
            <label>Editing prerequisites for…</label>
            <select
              value={selectedId ?? ""}
              onChange={(e) => selectSkill(Number(e.target.value))}
            >
              <option value="" disabled>
                — Select a skill —
              </option>
              {sortedNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          {!selectedNode ? (
            <p className="meta">
              Select a skill above, or click a node in the graph, to view its
              prerequisites.
            </p>
          ) : (
            <div
              className="stack"
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <p className="meta" style={{ marginBottom: 6 }}>
                  Current prerequisites
                </p>
                {selectedNode.prerequisites.length === 0 ? (
                  <p className="meta">None — entry-level skill.</p>
                ) : (
                  <ul className="skill-graph-prereq-list">
                    {selectedNode.prerequisites.map((pid) => (
                      <li key={pid}>
                        <span>{nameMap[pid] || `#${pid}`}</span>
                        {canEdit && (
                          <button
                            type="button"
                            className="skills-mini-action danger"
                            disabled={mutating}
                            onClick={() => handleRemove(pid)}
                            aria-label={`Remove ${nameMap[pid] || "prerequisite"}`}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {canEdit && (
                <div>
                  <div className="field">
                    <label>Add prerequisite</label>
                    <select
                      value={addChoice}
                      onChange={(e) => {
                        setAddChoice(e.target.value);
                        setAddError("");
                      }}
                    >
                      <option value="">— Choose a skill —</option>
                      {Object.entries(addOptionsByCategory).map(
                        ([cat, opts]) => (
                          <optgroup key={cat} label={cat}>
                            {opts.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.name}
                              </option>
                            ))}
                          </optgroup>
                        ),
                      )}
                    </select>
                  </div>
                  {addError && (
                    <p className="feedback error" style={{ fontSize: 13 }}>
                      {addError}
                    </p>
                  )}
                  <button
                    type="button"
                    className="skills-action primary"
                    style={{ width: "100%", marginTop: 8 }}
                    disabled={!addChoice || mutating}
                    onClick={handleAdd}
                  >
                    Add prerequisite
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
