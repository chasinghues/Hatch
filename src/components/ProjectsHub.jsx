import React, { useState, useEffect } from 'react';
import { Folder, FileVideo, Calendar, HardDrive, RefreshCw, ChevronRight, ArrowLeft, CheckCircle, AlertTriangle, X, Search, Filter, Clock, Archive, Database, User as UserIcon, LayoutGrid, List, Trash2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import IngestPanel from './IngestPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NodeList } from "@/components/DirectoryStructure"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Main Projects Hub Component
export default function ProjectsHub({ onBack, initialDestination, initialProjectContext }) {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [viewMode, setViewMode] = useState('hub'); // 'hub', 'ingest'
    const [projectStructure, setProjectStructure] = useState(null);
    const [logs, setLogs] = useState([]);
    const [detailedLog, setDetailedLog] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);

    // Ingest State
    const [activeIngestDestination, setActiveIngestDestination] = useState(null);
    const [isLoadingStructure, setIsLoadingStructure] = useState(false);

    // Sort & Filter State
    const [sortBy, setSortBy] = useState('date'); // 'date', 'client', 'type'
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClient, setFilterClient] = useState('ALL');
    const [filterType, setFilterType] = useState('ALL');

    // Load Data
    const loadData = async () => {
        if (window.electronAPI) {
            const loadedProjects = await window.electronAPI.getProjects();
            setProjects(loadedProjects || []);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Initial Selection Logic
    useEffect(() => {
        if (initialDestination && projects.length > 0) {
            // Find project if exists
            const existing = projects.find(p => p.path === initialDestination);
            if (existing) {
                handleProjectSelect(existing);
            } else if (initialProjectContext) {
                // Temporary Project Object for immediate view
                const tempProject = {
                    id: 'temp-' + Date.now(),
                    ...initialProjectContext,
                    path: initialDestination
                };
                setSelectedProject(tempProject);
                loadStructure(tempProject.path);
            }
        }
    }, [initialDestination, projects]);

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        loadStructure(project.path);
    };

    const loadStructure = async (path) => {
        setIsLoadingStructure(true);
        setProjectStructure(null);
        setLogs([]);
        if (window.electronAPI) {
            const struct = await window.electronAPI.readStructure(path);
            setProjectStructure(struct);

            // Load Logs & Filter by Project Path
            const loadedLogs = await window.electronAPI.getLogs(path);
            if (loadedLogs && Array.isArray(loadedLogs)) {
                // strict check: log destination must be within project root
                const filteredLogs = loadedLogs.filter(l => l.destination && l.destination.startsWith(path));
                setLogs(filteredLogs);
            } else {
                setLogs([]);
            }
        }
        setIsLoadingStructure(false);
    };

    const confirmDelete = async () => {
        if (!projectToDelete) return;

        if (window.electronAPI) {
            await window.electronAPI.deleteProject(projectToDelete.id);
            if (selectedProject?.id === projectToDelete.id) {
                setSelectedProject(null);
                setProjectStructure(null);
            }
            loadData();
        }
        setProjectToDelete(null);
    };

    const initiationDelete = (e, project) => {
        e.stopPropagation();
        setProjectToDelete(project);
    };

    const handleIngestRequest = (destinationId) => {
        // Switch to Ingest Mode
        setActiveIngestDestination(destinationId);
        setViewMode('ingest');
    };

    const filteredProjects = projects.filter(p => {
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (filterClient !== 'ALL' && p.client !== filterClient) return false;
        if (filterType !== 'ALL' && p.type !== filterType) return false;
        return true;
    });

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (sortBy === 'date') return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
        if (sortBy === 'client') return (a.client || '').localeCompare(b.client || '');
        if (sortBy === 'type') return (a.type || '').localeCompare(b.type || '');
        return 0;
    });

    // Extract unique options for filters
    const uniqueClients = Array.from(new Set(projects.map(p => p.client).filter(Boolean))).sort();
    const uniqueTypes = Array.from(new Set(projects.map(p => p.type).filter(Boolean))).sort();

    // Derived Stats
    const totalIngests = logs.length;
    const lastIngestDate = logs.length > 0
        ? new Date(Math.max(...logs.map(l => new Date(l.timestamp))))
        : null;

    if (viewMode === 'ingest' && selectedProject) {
        return (
            <IngestPanel
                destination={activeIngestDestination || selectedProject.path}
                projectMetadata={selectedProject}
                onBack={() => {
                    setViewMode('hub');
                    loadStructure(selectedProject.path); // Reload logs
                }}
            />
        );
    }

    return (
        <div className="flex flex-col h-full gap-4 relative z-10 pt-14 px-6 flex-1 w-full">
            {/* Header */}
            <div className="flex items-center justify-between pl-1 pr-4 py-2 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-20">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Folder className="w-5 h-5 text-primary" />
                        Projects
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage initialized projects</p>
                </div>
            </div>

            <div className="grid grid-cols-[300px_1fr] gap-6 flex-1 overflow-hidden">
                {/* Left: Project List */}
                <Card className="bg-card/30 backdrop-blur-xl border-white/5 flex flex-col overflow-hidden">
                    <CardHeader className="py-4 border-b border-white/5 bg-black/10 space-y-3">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <List className="w-3 h-3" /> Recent Projects
                        </CardTitle>

                        {/* Filters in Sidebar */}
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search projects..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-8 pl-8 bg-background/50 border-white/10 text-xs w-full"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Select value={filterClient} onValueChange={setFilterClient}>
                                    <SelectTrigger className="h-7 bg-background/50 border-white/10 text-[10px] flex-1">
                                        <SelectValue placeholder="Client" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Clients</SelectItem>
                                        {uniqueClients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger className="h-7 bg-background/50 border-white/10 text-[10px] flex-1">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Types</SelectItem>
                                        {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {projects.length === 0 && <p className="text-xs text-center text-muted-foreground p-4">No projects initialized.</p>}
                            {filteredProjects.length === 0 && projects.length > 0 && <p className="text-xs text-center text-muted-foreground p-4">No projects match filters.</p>}
                            {sortedProjects.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handleProjectSelect(p)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg text-sm transition-all border border-transparent group relative cursor-pointer overflow-hidden",
                                        selectedProject?.id === p.id
                                            ? "bg-primary/10 border-primary/20 text-primary font-medium"
                                            : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex justify-between items-center mb-1 relative z-10 w-full overflow-hidden">
                                        <span className="font-semibold whitespace-nowrap truncate block text-base flex-1 min-w-0 pr-2">{p.name}</span>
                                        {selectedProject?.id === p.id && <ChevronRight className="w-4 h-4 shrink-0 text-primary" />}
                                    </div>

                                    <div className="flex relative z-10 opacity-0 group-hover:opacity-100 transition-opacity h-6 mt-1">
                                        <button
                                            onClick={(e) => initiationDelete(e, p)}
                                            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-0 py-1"
                                            title="Delete Project"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> <span className="font-medium">Delete</span>
                                        </button>
                                    </div>



                                    {selectedProject?.id === p.id && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none z-0" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Right: Project Details & Tabs */}
                {selectedProject ? (
                    <div className="flex flex-col gap-4 overflow-hidden h-full">
                        {/* Project Header */}
                        <div className="flex justify-between items-start bg-card/30 p-6 rounded-xl border border-white/5 backdrop-blur-md">
                            <div>
                                <h3 className="text-3xl font-bold tracking-tight text-white mb-2">{selectedProject.name}</h3>
                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-mono">
                                    <div className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-primary" /> {selectedProject.client}</div>
                                    <div className="flex items-center gap-1.5"><FileVideo className="w-3.5 h-3.5 text-blue-400" /> {selectedProject.type}</div>
                                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-orange-400" /> {format(new Date(selectedProject.date), 'PPP')}</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Badge variant="outline" className="font-mono text-xs bg-black/20 border-white/10">
                                    ID: {selectedProject.id.slice(0, 8)}...
                                </Badge>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-white" onClick={() => {
                                    if (window.electronAPI) window.electronAPI.openPath(selectedProject.path);
                                }}>
                                    Open in Finder <ArrowLeft className="w-3 h-3 ml-1 rotate-180" />
                                </Button>
                            </div>
                        </div>

                        {/* Tabs Interface */}
                        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList className="w-full justify-start border-b border-white/10 rounded-none bg-transparent p-0 h-auto">
                                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Overview</TabsTrigger>
                                <TabsTrigger value="structure" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Structure</TabsTrigger>
                            </TabsList>

                            {/* Content: Overview */}
                            {/* Content: Overview */}
                            <TabsContent value="overview" className="flex-1 overflow-hidden p-4 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300 data-[state=active]:flex flex-col">
                                {/* Top Stats Row */}
                                <div className="grid grid-cols-3 gap-4 shrink-0">
                                    <Card className="bg-black/20 border-white/5">
                                        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Ingests</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{totalIngests}</div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-black/20 border-white/5">
                                        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Last Activity</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="text-sm font-medium">{lastIngestDate ? format(lastIngestDate, 'MMM d, h:mm a') : 'No activity'}</div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-black/20 border-white/5">
                                        <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Project Path</CardTitle></CardHeader>
                                        <CardContent>
                                            <code className="text-xs break-all opacity-70">{selectedProject.path}</code>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Quick Actions */}
                                <Card className="bg-black/20 border-white/5 shrink-0">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
                                    <CardContent className="flex gap-4">
                                        <Button variant="outline" onClick={() => loadStructure(selectedProject.path)}>
                                            <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
                                        </Button>
                                        <Button variant="default" onClick={() => {
                                            // Find root node or first folder to suggest ingest?
                                            // Fallback to project root path if structure is not yet loaded or empty
                                            const targetId = projectStructure?.children?.[0]?.id || projectStructure?.id || selectedProject.path;
                                            handleIngestRequest(targetId);
                                        }}>
                                            <HardDrive className="mr-2 h-4 w-4" /> New Ingest
                                        </Button>
                                        <Button variant="destructive" onClick={(e) => initiationDelete(e, selectedProject)}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Project
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Ingest History Section */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between mb-2 shrink-0">
                                        <h4 className="text-sm font-medium flex items-center gap-2">
                                            Ingest History
                                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-white/10">{logs.length}</Badge>
                                        </h4>
                                    </div>
                                    <ScrollArea className="flex-1 border rounded-xl bg-black/20 p-4">
                                        {logs.length === 0 ? (
                                            <div className="text-center text-muted-foreground py-10 opacity-50 flex flex-col items-center gap-2">
                                                <Clock className="w-8 h-8" />
                                                <p>No ingest history recorded for this project.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((log, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-white/10 transition-all cursor-pointer group"
                                                        onClick={() => setDetailedLog(log)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn("p-2 rounded-full", log.status === 'SUCCESS' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500")}>
                                                                {log.status === 'SUCCESS' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium flex items-center gap-2">
                                                                    {format(new Date(log.timestamp), 'PPP')}
                                                                    <span className="text-xs text-muted-foreground font-mono">{format(new Date(log.timestamp), 'p')}</span>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                                                                    <span>Dest: <code className="bg-black/20 px-1 rounded">{log.destination}</code></span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6 text-xs text-right text-muted-foreground">
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-bold text-foreground">{log.filesCopied}</span>
                                                                <span>Copied</span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-bold text-foreground">{log.filesSkipped}</span>
                                                                <span>Skipped</span>
                                                            </div>
                                                            {log.filesFailed > 0 && (
                                                                <div className="flex flex-col items-end text-red-400">
                                                                    <span className="font-bold">{log.filesFailed}</span>
                                                                    <span>Failed</span>
                                                                </div>
                                                            )}
                                                            <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                            </TabsContent>

                            {/* Content: Structure */}
                            <TabsContent value="structure" className="flex-1 m-0 p-0 !mt-0 data-[state=active]:flex flex-col justify-start">
                                <div className="flex-1 overflow-y-auto pt-4 px-4 pb-4">
                                    {isLoadingStructure ? (
                                        <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Loading structure...
                                        </div>
                                    ) : projectStructure ? (
                                        <NodeList
                                            nodes={[projectStructure]}
                                            readOnly={true}
                                            onIngest={(node) => handleIngestRequest(node.id)}
                                            renderRightAccessory={(node) => {
                                                // Latest log badge logic
                                                const nodeLogs = logs.filter(l => l.destination === node.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                                                const latestLog = nodeLogs[0];
                                                const status = latestLog ? latestLog.status : null;

                                                if (!latestLog) return null;

                                                return (
                                                    <div className="cursor-pointer ml-2" onClick={(e) => { e.stopPropagation(); setDetailedLog(latestLog); }}>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] h-5 px-1 bg-transparent border-opacity-50",
                                                            status === 'SUCCESS' ? "border-green-500 text-green-500" : "border-yellow-500 text-yellow-500"
                                                        )}>
                                                            {latestLog.filesCopied} files
                                                        </Badge>
                                                    </div>
                                                );
                                            }}
                                        />
                                    ) : (
                                        <div className="text-center text-muted-foreground py-10 opacity-50">
                                            Structure unavailable.
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                ) : (
                    <Card className="bg-card/30 backdrop-blur-xl border-white/5 flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                        <Archive className="w-12 h-12 opacity-20" />
                        <div className="text-center">
                            <h3 className="text-lg font-medium text-foreground">No Project Selected</h3>
                            <p className="text-sm opacity-70 max-w-xs mx-auto mt-2">Select a project from the left sidebar to view details, structure, and ingest history.</p>
                        </div>
                    </Card>
                )}
            </div>

            {/* Detailed Log Dialog */}
            <Dialog open={!!detailedLog} onOpenChange={(open) => !open && setDetailedLog(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Ingest Details</DialogTitle>
                        <DialogDescription className="flex gap-4 pt-2">
                            <span>{detailedLog && format(new Date(detailedLog.timestamp), 'PPP pp')}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 min-h-0 flex flex-col gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm shrink-0">
                            <div className="p-3 bg-muted rounded space-y-2">
                                <div>
                                    <label className="text-xs opacity-50 uppercase block">Destination Directory</label>
                                    <div className="break-all font-mono text-xs">{detailedLog?.destination}</div>
                                </div>
                                {detailedLog?.details && (
                                    <div>
                                        <label className="text-xs opacity-50 uppercase block">Primary Source Directory</label>
                                        <div className="font-mono text-xs">
                                            {(() => {
                                                // Priority 1: Top-level sourceDirectory (new logs)
                                                if (detailedLog.sourceDirectory) {
                                                    return <span className="break-all">{detailedLog.sourceDirectory}</span>;
                                                }

                                                // Priority 2: Extract from file details (fallback)
                                                const all = [...(detailedLog.details.copied || []), ...(detailedLog.details.failed || []), ...(detailedLog.details.skipped || [])];
                                                const first = all.find(x => x.source);

                                                if (!first) {
                                                    return <span className="text-muted-foreground opacity-50 italic">Unknown</span>;
                                                }

                                                const src = first.source;
                                                // Handle both / and \ separators
                                                const lastSlash = Math.max(src.lastIndexOf('/'), src.lastIndexOf('\\'));
                                                return <span className="break-all">{lastSlash > -1 ? src.substring(0, lastSlash) : src}</span>;
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded text-center">
                                    <div className="text-xl font-bold text-green-500">{detailedLog?.filesCopied}</div>
                                    <div className="text-xs text-muted-foreground font-bold text-green-600">Copied</div>
                                </div>
                                <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-center">
                                    <div className="text-xl font-bold text-yellow-500">{detailedLog?.filesSkipped}</div>
                                    <div className="text-xs text-muted-foreground font-bold text-yellow-600">Skipped</div>
                                </div>
                                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-center">
                                    <div className="text-xl font-bold text-red-500">{detailedLog?.filesFailed}</div>
                                    <div className="text-xs text-muted-foreground font-bold text-red-600">Failed</div>
                                </div>
                            </div>
                        </div>

                        {/* File List Container - Fixed height with native scrolling for max reliability */}
                        <div className="flex-1 border rounded-md bg-black/40 overflow-auto relative">
                            {!detailedLog?.details ? (
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                    Detailed file logs not available for this entry.
                                </div>
                            ) : (
                                <div className="text-xs divide-y divide-white/5 font-mono min-w-max p-2">
                                    {/* Copied */}
                                    {detailedLog.details.copied && detailedLog.details.copied.map((f, i) => (
                                        <div key={`c-${i}`} className="flex flex-col gap-1 p-2 hover:bg-green-500/5 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                                                <span className="font-medium">{typeof f === 'string' ? f : f.name}</span>
                                                <span className="opacity-50 ml-2">{(typeof f === 'object' && f.size) ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
                                                <Badge variant="outline" className="text-[10px] h-5 border-green-500/30 text-green-500">
                                                    {typeof f === 'string' ? 'COPIED' : (f.verification || 'COPIED')}
                                                </Badge>
                                            </div>
                                            {f.source && <div className="text-[10px] text-muted-foreground pl-5">Source: {f.source}</div>}
                                        </div>
                                    ))}
                                    {/* Skipped */}
                                    {detailedLog.details.skipped && detailedLog.details.skipped.map((f, i) => (
                                        <div key={`s-${i}`} className="flex flex-col gap-1 p-2 bg-yellow-500/5 hover:bg-yellow-500/10 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                                                <span className="grayscale opacity-70">{typeof f === 'string' ? f : f.name}</span>
                                                <Badge variant="outline" className="text-[10px] h-5 border-yellow-500/30 text-yellow-500">
                                                    SKIPPED
                                                </Badge>
                                            </div>
                                            <div className="pl-5 text-yellow-500/80">Reason: {f.reason || 'Unknown'}</div>
                                            {f.source && <div className="text-[10px] text-muted-foreground pl-5">Source: {f.source}</div>}
                                        </div>
                                    ))}
                                    {/* Failed */}
                                    {detailedLog.details.failed && detailedLog.details.failed.map((f, i) => (
                                        <div key={`f-${i}`} className="flex flex-col gap-1 p-2 bg-red-500/10 hover:bg-red-500/20 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <X className="w-3 h-3 text-red-500 shrink-0" />
                                                <span className="text-red-200">{f.file || f.name}</span>
                                                <Badge variant="outline" className="text-[10px] h-5 border-red-500/30 text-red-500 bg-red-500/10">FAILED</Badge>
                                            </div>
                                            <div className="pl-5 text-red-400 font-bold">Error: {f.error}</div>
                                            {f.source && <div className="text-[10px] text-muted-foreground pl-5">Source: {f.source}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <AlertDialogContent className="bg-[#16191f] border-white/10 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            This will permanently remove <span className="text-white font-medium">"{projectToDelete?.name}"</span> from your projects list.
                            <br /><br />
                            Note: This action <strong>does not</strong> delete the actual files from your computer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-500 hover:bg-red-600 text-white border-0">
                            Delete Project
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
