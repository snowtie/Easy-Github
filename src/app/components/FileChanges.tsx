import { useEffect, useMemo, useState, type MouseEvent, type WheelEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { toast } from "sonner";
import { GitBranch } from "lucide-react";

const ACTIVE_PROJECT_PATH_KEY = "activeProjectPath";
const ACTIVE_PROJECT_NAME_KEY = "activeProjectName";
const MAX_COMMITS = 200;

const GRAPH_COLORS = ["#2563eb", "#16a34a", "#f97316", "#dc2626", "#7c3aed", "#0ea5e9"];

interface GraphNode {
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  date: string;
  parents: string[];
  refs: string[];
  lane: number;
}

interface GraphEdge {
  from: string;
  to: string;
  fromLane: number;
  toLane: number;
}

function buildGraph(nodes: GraphNode[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const laneByHash = new Map<string, number>();
  const activeLanes: string[] = [];
  const edges: GraphEdge[] = [];

  const normalized = nodes.map((node) => ({ ...node, lane: 0 }));

  normalized.forEach((node) => {
    const existingLane = laneByHash.get(node.hash);
    let lane = existingLane ?? activeLanes.indexOf(node.hash);

    if (lane < 0) {
      lane = activeLanes.length;
      activeLanes.push(node.hash);
    }

    laneByHash.set(node.hash, lane);
    node.lane = lane;

    activeLanes[lane] = node.parents[0] ?? "";

    node.parents.forEach((parentHash, index) => {
      if (!parentHash) return;
      const parentLane = laneByHash.get(parentHash) ?? lane + index + 1;
      laneByHash.set(parentHash, parentLane);
      if (!activeLanes[parentLane]) {
        activeLanes[parentLane] = parentHash;
      }
      edges.push({ from: node.hash, to: parentHash, fromLane: lane, toLane: parentLane });
    });
  });

  return { nodes: normalized, edges };
}

export function FileChanges() {
  const [activeProjectPath, setActiveProjectPath] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "");
  const [activeProjectName, setActiveProjectName] = useState<string>(() => localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "");
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedCommit, setSelectedCommit] = useState<GraphNode | null>(null);

  useEffect(() => {
    const refresh = async () => {
      if (!window.easyGithub) {
        toast.error("Electron 환경에서만 변경사항 조회를 지원합니다");
        return;
      }

      const repoPath = localStorage.getItem(ACTIVE_PROJECT_PATH_KEY) || "";
      const repoName = localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "";
      setActiveProjectPath(repoPath);
      setActiveProjectName(repoName);

      if (!repoPath) {
        setGraphNodes([]);
        setGraphEdges([]);
        return;
      }

      setBusy(true);
      try {
        const raw = await window.easyGithub.git.graphLog(repoPath, MAX_COMMITS);
        const nodes = raw.map((item) => ({ ...item, lane: 0 }));
        const { nodes: withLanes, edges } = buildGraph(nodes);
        setGraphNodes(withLanes);
        setGraphEdges(edges);
        setSelectedCommit((prev) => {
          if (!prev) return null;
          return withLanes.find((node) => node.hash === prev.hash) ?? null;
        });
      } catch (err: any) {
        toast.error(err?.message || "커밋 그래프를 불러오지 못했습니다");
      } finally {
        setBusy(false);
      }
    };

    refresh();
    const handleActiveProjectChanged = () => {
      void refresh();
    };

    window.addEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
    return () => window.removeEventListener("easygithub:active-project-changed", handleActiveProjectChanged);
  }, []);

  const viewBox = useMemo(() => {
    const rowHeight = 70;
    const colWidth = 120;
    const maxLane = graphNodes.length > 0 ? Math.max(...graphNodes.map((n) => n.lane)) : 0;
    const height = Math.max(400, graphNodes.length * rowHeight + 120);
    const width = Math.max(600, (Math.max(1, maxLane + 2) * colWidth));
    return { width, height };
  }, [graphNodes]);

  const laneColor = (lane: number) => GRAPH_COLORS[lane % GRAPH_COLORS.length];

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextZoom = Math.min(2.2, Math.max(0.6, zoom - event.deltaY * 0.001));
    setZoom(nextZoom);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    setDragging(true);
    setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>커밋 브랜치 그래프</CardTitle>
              <CardDescription>
                {activeProjectName ? (
                  <span>
                    현재 프로젝트: <strong>{activeProjectName}</strong>
                  </span>
                ) : (
                  "현재 프로젝트가 선택되지 않았습니다"
                )}
                {activeProjectPath ? (
                  <span className="block text-xs font-mono mt-1">{activeProjectPath}</span>
                ) : null}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetView} disabled={busy}>
                뷰 초기화
              </Button>
              <Badge variant="outline" className="text-xs">
                최근 {MAX_COMMITS}개
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!activeProjectPath ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="font-semibold">현재 프로젝트가 선택되지 않았어요</p>
              <p className="text-sm mt-2">"프로젝트" 탭에서 저장소를 선택하세요.</p>
            </div>
          ) : graphNodes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>커밋 그래프를 불러오지 못했습니다</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div
                className="h-[640px] rounded-lg border bg-slate-950/95 text-slate-100 overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: dragging ? "grabbing" : "grab" }}
              >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
              >
                {graphEdges.map((edge) => {
                  const fromIndex = graphNodes.findIndex((node) => node.hash === edge.from);
                  const toIndex = graphNodes.findIndex((node) => node.hash === edge.to);
                  if (fromIndex < 0 || toIndex < 0) return null;

                  const rowHeight = 70;
                  const colWidth = 120;
                  const startX = edge.fromLane * colWidth + 60;
                  const startY = fromIndex * rowHeight + 40;
                  const endX = edge.toLane * colWidth + 60;
                  const endY = toIndex * rowHeight + 40;
                  const midX = (startX + endX) / 2;

                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                      stroke={laneColor(edge.fromLane)}
                      strokeWidth={3}
                      fill="none"
                      opacity={0.6}
                    />
                  );
                })}

                {graphNodes.map((node, index) => {
                  const rowHeight = 70;
                  const colWidth = 120;
                  const cx = node.lane * colWidth + 60;
                  const cy = index * rowHeight + 40;

                  return (
                    <g key={node.hash}>
                      <circle cx={cx} cy={cy} r={10} fill={laneColor(node.lane)} />
                      <circle cx={cx} cy={cy} r={16} stroke={laneColor(node.lane)} strokeWidth={2} fill="none" opacity={0.5} />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={20}
                        fill="transparent"
                        onClick={() => setSelectedCommit(node)}
                        style={{ cursor: "pointer" }}
                      />
                      <foreignObject x={cx + 24} y={cy - 22} width={viewBox.width - cx - 48} height={60}>
                        <div className="text-slate-100">
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span className="font-mono">{node.hash.slice(0, 7)}</span>
                            <span>{new Date(node.date).toLocaleString()}</span>
                            {node.refs.length > 0 ? (
                              <span className="rounded-full border border-slate-500 px-2 py-0.5 text-[10px]">
                                {node.refs.join(", ")}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-sm font-semibold text-slate-100">{node.message}</div>
                          <div className="text-xs text-slate-400">{node.authorName}</div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            </div>
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm">커밋 상세</CardTitle>
                <CardDescription className="text-xs">
                  노드를 클릭하면 상세 정보가 표시됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selectedCommit ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">메시지</p>
                      <p className="font-semibold">{selectedCommit.message}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">작성자</p>
                      <p>{selectedCommit.authorName}</p>
                      <p className="text-xs text-muted-foreground">{selectedCommit.authorEmail}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">커밋 해시</p>
                      <p className="font-mono text-xs break-all">{selectedCommit.hash}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">부모</p>
                      <p className="font-mono text-xs break-all">
                        {selectedCommit.parents.length > 0 ? selectedCommit.parents.join(", ") : "없음"}
                      </p>
                    </div>
                    {selectedCommit.refs.length > 0 ? (
                      <div>
                        <p className="text-xs text-muted-foreground">refs</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedCommit.refs.map((ref) => (
                            <span
                              key={ref}
                              className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">선택된 커밋이 없습니다.</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        </CardContent>
      </Card>
    </div>
  );
}
