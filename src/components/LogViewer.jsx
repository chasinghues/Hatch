import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from 'date-fns';
import { FileText, AlertTriangle, CheckCircle, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function LogViewer({ onBack }) {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getLogs().then(res => {
                if (Array.isArray(res)) setLogs(res);
            });
        }
    }, []);

    const clearLogs = async () => {
        if (confirm("Clear all logs?")) {
            if (window.electronAPI) {
                await window.electronAPI.clearLogs();
                setLogs([]);
            }
        }
    };

    return (
        <div className="h-full p-6 flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="w-6 h-6 text-primary" />
                    Ingest Logs
                </h2>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={clearLogs} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4 mr-2" /> Clear History
                    </Button>
                    <Button variant="ghost" onClick={onBack}>Back</Button>
                </div>
            </div>

            <ScrollArea className="flex-1 border rounded-xl bg-black/20">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground opacity-50">
                        <FileText className="w-12 h-12 mb-4" />
                        <p>No logs found.</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {logs.map((log) => (
                            <Card key={log.id} className="bg-card/50 border-white/5">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                {log.status === 'SUCCESS' ?
                                                    <CheckCircle className="w-4 h-4 text-green-500" /> :
                                                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                                }
                                                {log.description || "Ingest Operation"}
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground font-mono">
                                                {format(new Date(log.timestamp), 'PPP pp')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-primary">{log.projectName}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{log.projectType}</div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="opacity-50 block mb-1">Destination</span>
                                            <code className="bg-black/30 px-1 py-0.5 rounded break-all">{log.destination}</code>
                                        </div>
                                        <div className="flex gap-4">
                                            <div>
                                                <span className="opacity-50 block">Copied</span>
                                                <span className="text-green-400 font-bold">{log.filesCopied}</span>
                                            </div>
                                            <div>
                                                <span className="opacity-50 block">Skipped</span>
                                                <span className="text-yellow-400 font-bold">{log.filesSkipped}</span>
                                            </div>
                                            <div>
                                                <span className="opacity-50 block">Failed</span>
                                                <span className="text-red-400 font-bold">{log.filesFailed}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
