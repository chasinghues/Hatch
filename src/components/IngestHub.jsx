import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, HardDrive, History, ArrowLeft, FileText, CheckCircle, AlertTriangle, X, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import IngestPanel from './IngestPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function IngestHub({ onBack, initialDestination, initialProjectContext }) {
    const [projects, setProjects] = useState([]);
    const [logs, setLogs] = useState([]); // All logs
    const [selectedProject, setSelectedProject] = useState(null);
    const [viewMode, setViewMode] = useState('hub'); // 'hub', 'ingest'
    const [detailedLog, setDetailedLog] = useState(null); // The log entry to show details for
    const [activeIngestDestination, setActiveIngestDestination] = useState(null);

    // Load Data
    const loadData = async () => {
        if (window.electronAPI) {
            const [p, l] = await Promise.all([
                window.electronAPI.getProjects(),
                window.electronAPI.getLogs()
            ]);
            // Sort projects by date new to old
            const sortedProjects = Array.isArray(p) ? p.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
            setProjects(sortedProjects);
            setLogs(Array.isArray(l) ? l : []);

            return sortedProjects;
        }
        return [];
    };

    useEffect(() => {
        loadData().then((loadedProjects) => {
            if (initialDestination) {
                setActiveIngestDestination(initialDestination);

                // Try to find matching project
                const match = loadedProjects.find(p => initialDestination.includes(p.path) || (initialProjectContext && p.name === initialProjectContext.name));

                if (match) {
                    setSelectedProject(match);
                } else if (initialProjectContext) {
                    // Create temp project context
                    setSelectedProject({
                        id: 'temp',
                        name: initialProjectContext.name,
                        client: initialProjectContext.client,
                        type: initialProjectContext.type,
                        date: initialProjectContext.date,
                        path: initialProjectContext.path
                    });
                }
                setViewMode('ingest');
            }
        });
    }, [initialDestination]); // Only run when initialDestination changes (or mount)

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        setActiveIngestDestination(project.path); // Default to root
    };

    const handleStartIngest = () => {
        if (selectedProject) {
            setActiveIngestDestination(selectedProject.path);
            setViewMode('ingest');
        }
    };

    const getProjectLogs = (project) => {
        if (!project) return [];
        return logs.filter(l => {
            const pathMatch = l.destination && (l.destination.startsWith(project.path) || project.path.startsWith(l.destination)); // Loose match
            const nameMatch = l.projectName === project.name;
            return pathMatch || nameMatch;
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    };

    if (viewMode === 'ingest' && selectedProject) {
        return (
            <IngestPanel
                destination={activeIngestDestination || selectedProject.path}
                projectMetadata={{
                    projectName: selectedProject.name,
                    clientName: selectedProject.client,
                    projectType: selectedProject.type,
                    date: selectedProject.date
                }}
                onBack={() => setViewMode('hub')}
                onViewLogs={() => {
                    setViewMode('hub');
                }}
            />
        );
    }

    const filteredLogs = selectedProject ? getProjectLogs(selectedProject) : [];

    return (
        <div className="h-full flex flex-col p-6 gap-6 relative">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
                        <HardDrive className="h-8 w-8 text-primary" />
                        Ingest Hub
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage project media and logs</p>
                </div>
                {/* <Button variant="ghost" onClick={onBack}>Back to Home</Button> */}
            </div>

            <div className="grid grid-cols-[300px_1fr] gap-6 flex-1 overflow-hidden">
                {/* Left: Project List */}
                <Card className="bg-card/30 backdrop-blur-xl border-white/5 flex flex-col overflow-hidden">
                    <CardHeader className="py-4 border-b border-white/5">
                        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Projects</CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {projects.length === 0 && <p className="text-xs text-center text-muted-foreground p-4">No projects initialized yet.</p>}
                            {projects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleProjectSelect(p)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg text-sm transition-all border border-transparent",
                                        selectedProject?.id === p.id
                                            ? "bg-primary/20 border-primary/20 text-primary font-medium"
                                            : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="truncate w-full">{p.name}</span>
                                        {selectedProject?.id === p.id && <ChevronRight className="w-3 h-3" />}
                                    </div>
                                    <div className="text-[10px] opacity-70 flex justify-between">
                                        <span>{p.client}</span>
                                        <span>{format(new Date(p.date), 'MM/yy')}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Right: Details / Logs */}
                <Card className="bg-card/30 backdrop-blur-xl border-white/5 flex flex-col overflow-hidden p-6 gap-6">
                    {selectedProject ? (
                        <>
                            <div className="flex justify-between items-start border-b border-white/5 pb-6">
                                <div>
                                    <h3 className="text-2xl font-bold">{selectedProject.name}</h3>
                                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground font-mono">
                                        <div className="flex items-center gap-1"><Folder className="w-3 h-3" /> {selectedProject.type}</div>
                                        <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(selectedProject.date), 'PPP')}</div>
                                    </div>
                                    <code className="text-xs mt-2 block bg-black/20 px-2 py-1 rounded w-fit text-primary/80">{selectedProject.path}</code>
                                </div>
                                <Button size="lg" onClick={handleStartIngest} className="shadow-lg shadow-primary/20">
                                    <HardDrive className="w-4 h-4 mr-2" /> New Ingest
                                </Button>
                            </div>

                            <div className="flex-1 flex flex-col overflow-hidden">
                                <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                                    <History className="w-4 h-4 text-primary" />
                                    Ingest History
                                </h4>
                                <ScrollArea className="flex-1 border rounded-xl bg-black/20">
                                    {filteredLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground opacity-50">
                                            <p>No ingest records found for this project.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-white/5">
                                            {filteredLogs.map(log => (
                                                <div
                                                    key={log.id}
                                                    className="p-4 hover:bg-white/5 cursor-pointer transition-colors group"
                                                    onClick={() => setDetailedLog(log)}
                                                >
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {log.status === 'SUCCESS' ?
                                                                <CheckCircle className="w-4 h-4 text-green-500" /> :
                                                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                                            }
                                                            <span className="font-medium text-sm">{format(new Date(log.timestamp), 'PPP p')}</span>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">View Details</Badge>
                                                    </div>
                                                    <div className="flex gap-6 text-xs text-muted-foreground">
                                                        <span><strong className="text-foreground">{log.filesCopied}</strong> copied</span>
                                                        <span><strong className="text-foreground">{log.filesSkipped}</strong> skipped</span>
                                                        <span><strong className="text-foreground">{log.filesFailed}</strong> failed</span>
                                                    </div>
                                                    <div className="mt-2 text-[10px] font-mono opacity-50 truncate">
                                                        {log.destination}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <ArrowLeft className="w-8 h-8 mb-4 animate-pulse opacity-50" />
                            <p>Select a project to view details or start ingest.</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* Detailed Log Dialog */}
            <Dialog open={!!detailedLog} onOpenChange={(open) => !open && setDetailedLog(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Ingest Details</DialogTitle>
                        <DialogDescription className="flex gap-4 pt-2">
                            <span>{detailedLog && format(new Date(detailedLog.timestamp), 'PPP pp')}</span>
                            <span>•</span>
                            <span>{detailedLog?.projectType}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-muted rounded">
                                <label className="text-xs opacity-50 uppercase block">Destination</label>
                                <code className="break-all">{detailedLog?.destination}</code>
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

                        <ScrollArea className="flex-1 border rounded bg-black/40">
                            {/* Reconstruct file list from details if available */}
                            {!detailedLog?.details ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    Detailed file logs not available for this entry.
                                </div>
                            ) : (
                                <div className="text-xs divide-y divide-white/5 font-mono">
                                    {/* Copied */}
                                    {detailedLog.details.copied && detailedLog.details.copied.map((f, i) => (
                                        <div key={`c-${i}`} className="flex items-center gap-2 p-2 hover:bg-green-500/5">
                                            <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                                            <span className="flex-1 truncate">{typeof f === 'string' ? f : f.name}</span>
                                            <span className="opacity-50 mx-2">{(typeof f === 'object' && f.size) ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
                                            <Badge variant="outline" className="text-[10px] h-5 border-green-500/30 text-green-500">
                                                {typeof f === 'string' ? 'COPIED' : (f.verification || 'COPIED')}
                                            </Badge>
                                        </div>
                                    ))}
                                    {/* Skipped */}
                                    {detailedLog.details.skipped && detailedLog.details.skipped.map((f, i) => (
                                        <div key={`s-${i}`} className="flex items-center gap-2 p-2 hover:bg-yellow-500/5">
                                            <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                                            <span className="flex-1 truncate grayscale opacity-70">{typeof f === 'string' ? f : f.name}</span>
                                            <Badge variant="outline" className="text-[10px] h-5 border-yellow-500/30 text-yellow-500">
                                                {f.reason || 'SKIPPED'}
                                            </Badge>
                                        </div>
                                    ))}
                                    {/* Failed */}
                                    {detailedLog.details.failed && detailedLog.details.failed.map((f, i) => (
                                        <div key={`f-${i}`} className="flex items-center gap-2 p-2 bg-red-500/10">
                                            <X className="w-3 h-3 text-red-500 shrink-0" />
                                            <span className="flex-1 truncate text-red-200">{f.file || f.name}</span>
                                            <span className="text-red-400">{f.error}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
