import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import {
    Upload, FileText, CheckCircle, AlertTriangle, X,
    ArrowRight, FolderOpen, RefreshCcw, ShieldCheck
} from 'lucide-react';
import { cn } from "@/lib/utils"

export default function IngestPanel({ destination, projectMetadata, onBack }) {
    const { toast } = useToast();
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');

    // Results
    const [results, setResults] = useState(null);
    const [conflicts, setConflicts] = useState([]); // List of conflict objects
    const [showConflictParams, setShowConflictParams] = useState(false);
    const [logId, setLogId] = useState(null);

    // Logs
    useEffect(() => {
        const handleProgress = (data) => {
            setProgress(data.percent);
            setStatusMessage(data.message);
        };

        if (window.electronAPI) {
            window.electronAPI.onIngestProgress(handleProgress);
        }
        return () => {
            if (window.electronAPI) window.electronAPI.removeIngestProgressListener();
        };
    }, []);

    const handleSelectFiles = async () => {
        if (!window.electronAPI) return;
        const files = await window.electronAPI.selectFiles();
        if (files && files.length > 0) {
            // Filter duplicates
            const newFiles = files.filter(f => !selectedFiles.some(s => s.path === f.path));
            setSelectedFiles([...selectedFiles, ...newFiles]);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedPaths = Array.from(e.dataTransfer.files).map(f => f.path);

            if (window.electronAPI) {
                const expanded = await window.electronAPI.scanPaths(droppedPaths);
                const newFiles = expanded.filter(f => !selectedFiles.some(s => s.path === f.path));
                setSelectedFiles(prev => [...prev, ...newFiles]);
            }
        }
    };

    const handleRemoveFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const startIngest = async () => {
        if (selectedFiles.length === 0) return;
        setIsProcessing(true);
        setResults(null);
        setConflicts([]);
        setLogId(null);

        try {
            const res = await window.electronAPI.processIngest({
                files: selectedFiles,
                destination: destination,
                projectMetadata
            });

            setResults(res);
            if (res.logId) setLogId(res.logId);

            if (res.conflicts && res.conflicts.length > 0) {
                setConflicts(res.conflicts);
                setShowConflictParams(true);
            }
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Ingest Failed", description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResolveConflicts = async (action) => {
        // action: 'overwrite' | 'skip'
        setIsProcessing(true);
        try {
            const res = await window.electronAPI.resolveConflicts({
                conflicts: conflicts,
                action,
                destination,
                projectMetadata,
                logId
            });

            // Merge results
            setResults(prev => ({
                ...prev,
                copied: [...prev.copied, ...res.copied],
                failed: [...prev.failed, ...res.failed],
                skipped: [...prev.skipped, ...res.skipped],
                conflicts: [] // Cleared
            }));
            setConflicts([]);
            setShowConflictParams(false);

        } catch (error) {
            toast({ variant: "destructive", title: "Resolution Failed", description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setSelectedFiles([]);
        setResults(null);
        setProgress(0);
        setStatusMessage('');
        setLogId(null);
    };

    // --- Views ---

    if (results && conflicts.length === 0) {
        // Final Report View
        return (
            <Card className="h-full border-none bg-transparent shadow-none flex flex-col items-center justify-center p-8">
                <div className="bg-green-500/10 p-6 rounded-full mb-6">
                    <CheckCircle className="w-16 h-16 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold mb-2">Ingest Complete</h2>
                <p className="text-muted-foreground mb-8 text-center max-w-md">
                    Successfully verified and copied files to <br />
                    <code className="bg-white/5 px-2 py-1 rounded text-xs">{destination}</code>
                </p>

                <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mb-8">
                    <div className="bg-card/50 p-4 rounded-lg text-center border border-white/5">
                        <div className="text-2xl font-bold text-green-400">{results.copied.length}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Copied</div>
                    </div>
                    <div className="bg-card/50 p-4 rounded-lg text-center border border-white/5">
                        <div className="text-2xl font-bold text-yellow-400">{results.skipped.length}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Skipped</div>
                    </div>
                    <div className="bg-card/50 p-4 rounded-lg text-center border border-white/5">
                        <div className="text-2xl font-bold text-red-400">{results.failed.length}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Failed</div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button onClick={reset} variant="outline">Ingest More</Button>
                    <Button onClick={onBack}>Return to Project</Button>
                </div>
            </Card>
        );
    }

    if (showConflictParams) {
        // Conflict UI
        return (
            <Card className="max-w-xl mx-auto mt-10 border-red-500/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        Conflicts Detected
                    </CardTitle>
                    <CardDescription>
                        {conflicts.length} files already exist in the destination folder.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ScrollArea className="h-48 border rounded-md p-4 bg-black/20">
                        {conflicts.map((c, i) => (
                            <div key={i} className="text-sm py-1 border-b border-white/5 last:border-0 flex justify-between">
                                <span className="opacity-80">{c.name}</span>
                                <span className="text-xs opacity-50">{(c.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                        ))}
                    </ScrollArea>

                    <div className="flex flex-col gap-2">
                        <Button onClick={() => handleResolveConflicts('overwrite')} variant="destructive" className="w-full">
                            Overwrite All
                        </Button>
                        <Button onClick={() => handleResolveConflicts('skip')} variant="secondary" className="w-full">
                            Skip All (Keep Existing)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <FolderOpen className="w-6 h-6 text-primary" />
                        Ingest Media
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Target: <span className="text-primary/80 font-mono">{destination}</span>
                    </p>
                </div>
                <Button variant="ghost" onClick={onBack}>Close</Button>
            </div>

            {/* Drop Zone / List */}
            <div
                className={cn(
                    "flex-1 border-2 border-dashed rounded-xl flex flex-col transition-colors overflow-hidden",
                    selectedFiles.length === 0 ? "items-center justify-center border-white/20 hover:border-primary/50 hover:bg-white/5" : "border-white/10"
                )}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleDrop}
            >
                {selectedFiles.length === 0 ? (
                    <div className="text-center space-y-4" onClick={handleSelectFiles}>
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                            <Upload className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-lg font-medium">Drag & Drop files here</p>
                            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                        </div>
                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); handleSelectFiles(); }}>
                            Select Files
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                            <span className="font-bold">{selectedFiles.length} files selected</span>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={handleSelectFiles} disabled={isProcessing}>Add More</Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedFiles([])} disabled={isProcessing}>Clear All</Button>
                            </div>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-2">
                                {selectedFiles.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-card rounded border border-white/5 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileText className="w-4 h-4 text-primary shrink-0" />
                                            <span className="truncate text-sm">{file.relativePath || file.name}</span>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                            </span>
                                        </div>
                                        {/* Status indicator if processing */}
                                        {isProcessing && results && results.copied && results.copied.some(c => c.name === (file.relativePath || file.name)) && <CheckCircle className="w-4 h-4 text-green-500" />}
                                        {!isProcessing && (
                                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveFile(i)}>
                                                <X className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div className="bg-card p-4 rounded-xl border border-white/10 shadow-lg space-y-4">
                {isProcessing && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs uppercase tracking-wider font-bold text-muted-foreground">
                            <span>Ingesting...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-center opacity-50 truncate">{statusMessage}</p>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="w-4 h-4 text-green-500/50" />
                        Verification Enabled
                    </div>
                    <Button
                        size="lg"
                        onClick={startIngest}
                        disabled={selectedFiles.length === 0 || isProcessing}
                        className={cn("w-48 font-bold", isProcessing && "opacity-50 cursor-not-allowed")}
                    >
                        {isProcessing ? (
                            <>
                                <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                                Processing
                            </>
                        ) : (
                            <>
                                Begin Ingest <ArrowRight className="ml-2 w-4 h-4" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
