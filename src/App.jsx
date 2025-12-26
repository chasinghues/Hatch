import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layers, Folder, FileVideo, User, Calendar as CalendarIcon, Upload, ArrowRight, Check, AlertCircle, ChevronDown, ChevronRight, Settings as SettingsIcon, Plus, Trash2, Edit2, Download, Save, RefreshCw, X, HardDrive, History as HistoryIcon } from 'lucide-react';

import { format, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

// --- Constants ---

const PROJECT_TYPES = [
    { label: 'OG Content', value: 'OG_CONTENT' },
    { label: 'Reel', value: 'REEL' },
    { label: 'Ad Film', value: 'AD_FILM' },
    { label: 'Motion Graphics', value: 'MOTION_GRAPHICS' },
    { label: 'LED Video', value: 'LED_VIDEO' },
    { label: 'Corporate Video', value: 'CORPORATE_VIDEO' },
    { label: 'Internal', value: 'INTERNAL' },
];

const INITIAL_STRUCTURE = [
    { id: '01_FOOTAGE', name: '01_FOOTAGE', checked: true, children: [] },
    { id: '02_PROXIES', name: '02_PROXIES', checked: true, children: [] },
    {
        id: '03_AUDIO', name: '03_AUDIO', checked: true, children: [
            { id: '03_AUDIO/SFX', name: 'SFX', checked: true, children: [] },
            { id: '03_AUDIO/MUSIC', name: 'MUSIC', checked: true, children: [] },
            { id: '03_AUDIO/VO', name: 'VO', checked: true, children: [] }
        ]
    },
    {
        id: '04_VFX', name: '04_VFX', checked: true, children: [
            { id: '04_VFX/COMPS', name: 'COMPS', checked: true, children: [] },
            { id: '04_VFX/IN', name: 'IN', checked: true, children: [] },
            { id: '04_VFX/OUT', name: 'OUT', checked: true, children: [] }
        ]
    },
    { id: '05_COLOR', name: '05_COLOR', checked: true, children: [] },
    {
        id: '06_ASSETS', name: '06_ASSETS', checked: true, children: [
            { id: '06_ASSETS/STILLS', name: 'STILLS', checked: true, children: [] },
            { id: '06_ASSETS/GRAPHICS', name: 'GRAPHICS', checked: true, children: [] },
            { id: '06_ASSETS/LOGOS', name: 'LOGOS', checked: true, children: [] }
        ]
    },
    { id: '08_EXPORTS', name: '08_EXPORTS', checked: true, children: [] },
    { id: '09_DOCUMENTS', name: '09_DOCUMENTS', checked: true, children: [] },
];

function sanitize(str) {
    return str.trim().replace(/[^a-zA-Z0-9\-\s]/g, '');
}

function sanitizeClient(str) {
    return str.trim().replace(/[^\w\s-]/g, '');
}

function sanitizeNodeName(str) {
    // Uppercase, underscores instead of spaces, remove special chars
    return str.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}

// Re-indexes root folders based on their current array ORDER.
function reindexRootFolders(structure) {
    return structure.map((node, index) => {
        if (node.isEditing) return node;

        const num = String(index + 1).padStart(2, '0');
        let baseName = node.name.replace(/^\d+_/, '');
        if (!baseName) baseName = "UNTITLED";

        const newName = `${num}_${baseName}`;

        // Helper to rebuild IDs recursively based on path and preserve children names
        const rebuildIds = (n, currentName) => {
            const updateChildren = (children, parentId) => {
                if (!children) return [];
                return children.map(c => {
                    const childName = c.name;
                    const newId = `${parentId}/${childName}`;
                    return { ...c, id: newId, children: updateChildren(c.children, newId) };
                });
            };
            return { ...n, name: currentName, id: currentName, children: updateChildren(n.children, currentName) };
        };

        return rebuildIds(node, newName);
    });
}

const Sidebar = ({ activeTab, setActiveTab }) => {
    const items = [
        { id: 'project', icon: Layers, label: 'Structure' },
        { id: 'ingest', icon: HardDrive, label: 'Ingest' },
    ];

    return (
        <div className="w-[60px] bg-black/20 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 gap-4 z-50 pt-20">
            {items.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group relative",
                        activeTab === item.id ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)]" : "text-muted-foreground hover:bg-white/5 hover:text-white"
                    )}
                    title={item.label}
                >
                    <item.icon className="w-5 h-5" />
                    {activeTab === item.id && (
                        <motion.div layoutId="sidebar-active" className="absolute inset-0 rounded-xl bg-primary/20 -z-10" />
                    )}
                </button>
            ))}
        </div>
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 text-white bg-red-900/20 h-screen flex flex-col gap-4 overflow-auto">
                    <h1 className="text-2xl font-bold">Something went wrong.</h1>
                    <pre className="text-sm bg-black/50 p-4 rounded text-red-200 whitespace-pre-wrap">
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function App() {
    return (
        <ErrorBoundary>
            <MainApp />
        </ErrorBoundary>
    );
}

function MainApp() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('project'); // Navigation State

    // Data State
    const [projectType, setProjectType] = useState('OG_CONTENT');
    // ... (rest of existing state)
    const [clientName, setClientName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [date, setDate] = useState(new Date());

    const [destination, setDestination] = useState('');
    const [structure, setStructure] = useState(INITIAL_STRUCTURE);
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState(null);
    const [isClientOpen, setIsClientOpen] = useState(false);

    // Settings State
    const [clients, setClients] = useState(['Passio', 'Bismi']);
    const [templates, setTemplates] = useState([]);
    const [namingStructure, setNamingStructure] = useState(['CLIENT', 'PROJECT', 'TYPE', 'DATE']);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Ingest specific State
    const [ingestDestination, setIngestDestination] = useState('');

    // Load Persistence (Same as before)
    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.storeGet('clients').then(res => {
                if (res && Array.isArray(res)) setClients(res);
            });
            window.electronAPI.storeGet('namingStructure').then(res => {
                if (res && Array.isArray(res)) setNamingStructure(res);
            });
            window.electronAPI.storeGet('templates').then(res => {
                // ... (existing template defaults logic)
                const defaults = [
                    { name: "Professional (Default)", structure: INITIAL_STRUCTURE },
                    // ... (keep all defaults)
                ];
                // For brevity in replacement, assuming logic remains identical
                // In actual tool execution, I will preserve the existing logic by careful START/END lines
                // But for this replacement, I need to be careful not to delete the template initialization logic if I touch it.
                // Since I am replacing the `return` statement mostly, I will try to leave the state init logic alone if possible.
                // However, I need to inject the Sidebar.

                // Let's just fix the template loading logic to be robust in the replacement if I touch it.
                // Actually, I will target the `return` block mainly to inject the Sidebar.

                // Re-implementing just the necessary parts to ensure context is valid.
                const defaults_ = [
                    { name: "Professional (Default)", structure: INITIAL_STRUCTURE },
                    {
                        name: "Social Media (Short Form)",
                        structure: [
                            { id: '01_RAW', name: '01_RAW', checked: true, children: [] },
                            {
                                id: '02_ASSETS', name: '02_ASSETS', checked: true, children: [
                                    { id: '02_ASSETS/AUDIO', name: 'AUDIO', checked: true, children: [] },
                                    { id: '02_ASSETS/GRAPHICS', name: 'GRAPHICS', checked: true, children: [] },
                                    { id: '02_ASSETS/FONTS', name: 'FONTS', checked: true, children: [] }
                                ]
                            },
                            { id: '03_PROJECTS', name: '03_PROJECTS', checked: true, children: [] },
                            {
                                id: '04_EXPORTS', name: '04_EXPORTS', checked: true, children: [
                                    { id: '04_EXPORTS/DRAFTS', name: 'DRAFTS', checked: true, children: [] },
                                    { id: '04_EXPORTS/FINAL', name: 'FINAL', checked: true, children: [] }
                                ]
                            }
                        ]
                    },
                    {
                        name: "Documentary / Feature",
                        structure: [
                            {
                                id: '00_ADMIN', name: '00_ADMIN', checked: true, children: [
                                    { id: '00_ADMIN/AGREEMENTS', name: 'AGREEMENTS', checked: true, children: [] },
                                    { id: '00_ADMIN/SCRIPTS', name: 'SCRIPTS', checked: true, children: [] },
                                    { id: '00_ADMIN/LOGS', name: 'LOGS', checked: true, children: [] }
                                ]
                            },
                            {
                                id: '01_FOOTAGE', name: '01_FOOTAGE', checked: true, children: [
                                    { id: '01_FOOTAGE/INTERVIEWS', name: 'INTERVIEWS', checked: true, children: [] },
                                    { id: '01_FOOTAGE/BROLL', name: 'BROLL', checked: true, children: [] },
                                    { id: '01_FOOTAGE/ARCHIVAL', name: 'ARCHIVAL', checked: true, children: [] },
                                    { id: '01_FOOTAGE/DRONE', name: 'DRONE', checked: true, children: [] }
                                ]
                            },
                            {
                                id: '02_AUDIO', name: '02_AUDIO', checked: true, children: [
                                    { id: '02_AUDIO/INTERVIEWS', name: 'INTERVIEWS', checked: true, children: [] },
                                    { id: '02_AUDIO/MUSIC', name: 'MUSIC', checked: true, children: [] },
                                    { id: '02_AUDIO/SFX', name: 'SFX', checked: true, children: [] }
                                ]
                            },
                            { id: '03_PROJECTS', name: '03_PROJECTS', checked: true, children: [] },
                            { id: '04_GRAPHICS', name: '04_GRAPHICS', checked: true, children: [] },
                            { id: '05_EXPORTS', name: '05_EXPORTS', checked: true, children: [] }
                        ]
                    },
                    {
                        name: "VFX Pipeline",
                        structure: [
                            {
                                id: '01_IN', name: '01_IN', checked: true, children: [
                                    { id: '01_IN/PLATES', name: 'PLATES', checked: true, children: [] },
                                    { id: '01_IN/REF', name: 'REF', checked: true, children: [] },
                                    { id: '01_IN/LUTS', name: 'LUTS', checked: true, children: [] }
                                ]
                            },
                            {
                                id: '02_WORK', name: '02_WORK', checked: true, children: [
                                    { id: '02_WORK/3D', name: '3D', checked: true, children: [] },
                                    { id: '02_WORK/COMP', name: 'COMP', checked: true, children: [] },
                                    { id: '02_WORK/TRACKING', name: 'TRACKING', checked: true, children: [] }
                                ]
                            },
                            {
                                id: '03_RENDER', name: '03_RENDER', checked: true, children: [
                                    { id: '03_RENDER/WIP', name: 'WIP', checked: true, children: [] },
                                    { id: '03_RENDER/PRECOMP', name: 'PRECOMP', checked: true, children: [] }
                                ]
                            },
                            { id: '04_OUT', name: '04_OUT', checked: true, children: [] }
                        ]
                    },
                    {
                        name: "Color Grading Suite",
                        structure: [
                            {
                                id: '01_CONFORM', name: '01_CONFORM', checked: true, children: [
                                    { id: '01_CONFORM/XML_EDL', name: 'XML_EDL', checked: true, children: [] },
                                    { id: '01_CONFORM/REFERENCE', name: 'REFERENCE', checked: true, children: [] }
                                ]
                            },
                            { id: '02_SOURCE', name: '02_SOURCE', checked: true, children: [] },
                            {
                                id: '03_RENDER', name: '03_RENDER', checked: true, children: [
                                    { id: '03_RENDER/MASTER', name: 'MASTER', checked: true, children: [] },
                                    { id: '03_RENDER/DSM', name: 'DSM', checked: true, children: [] },
                                    { id: '03_RENDER/WEB', name: 'WEB', checked: true, children: [] }
                                ]
                            }
                        ]
                    }
                ];

                const saved = (res && Array.isArray(res)) ? res : [];
                const merged = [...saved];
                let hasChanges = false;
                defaults_.forEach(d => {
                    if (!merged.find(t => t.name === d.name)) {
                        merged.push(d);
                        hasChanges = true;
                    }
                });
                if (hasChanges || merged.length === 0) {
                    setTemplates(merged);
                    window.electronAPI.storeSet('templates', merged);
                } else {
                    setTemplates(saved);
                }
            });
        }
    }, []);

    const saveClients = (newClients) => {
        setClients(newClients);
        if (window.electronAPI) window.electronAPI.storeSet('clients', newClients);
    };

    const saveTemplates = (newTemplates) => {
        setTemplates(newTemplates);
        if (window.electronAPI) window.electronAPI.storeSet('templates', newTemplates);
    };

    const saveNamingStructure = (newStructure) => {
        setNamingStructure(newStructure);
        if (window.electronAPI) window.electronAPI.storeSet('namingStructure', newStructure);
    };

    // Logic
    const generatedName = useMemo(() => {
        const parts = [];
        namingStructure.forEach(token => {
            switch (token) {
                case 'CLIENT':
                    if (clientName && clientName.trim()) parts.push(sanitize(clientName));
                    break;
                case 'PROJECT':
                    if (projectName.trim()) parts.push(sanitize(projectName));
                    break;
                case 'TYPE':
                    parts.push(projectType);
                    break;
                case 'DATE':
                    if (date && isValid(date)) parts.push(format(date, 'dd-MM-yy'));
                    break;
            }
        });
        return parts.join('_').toUpperCase();
    }, [namingStructure, projectType, clientName, projectName, date]);

    const handleToggle = (id, checked) => {
        const update = (nodes) => nodes.map(node => {
            if (node.id === id) {
                if (!checked && node.children) {
                    return { ...node, checked, children: node.children.map(c => ({ ...c, checked: false })) };
                }
                return { ...node, checked };
            }
            if (node.children) {
                return { ...node, children: update(node.children) };
            }
            return node;
        });
        setStructure(update(structure));
    };

    const handleCreate = async () => {
        if (!projectName.trim()) {
            setStatus({ type: 'error', message: 'Project Name is required.' });
            return;
        }
        if (!destination) {
            setStatus({ type: 'error', message: 'Please select a destination folder.' });
            return;
        }

        setIsCreating(true);
        setStatus(null);

        const getPaths = (nodes) => {
            let paths = [];
            nodes.forEach(node => {
                if (node.isEditing) return; // Skip temp

                if (node.checked) {
                    paths.push(node.id);
                    if (node.children) {
                        paths = [...paths, ...getPaths(node.children)];
                    }
                }
            });
            return paths;
        };

        const foldersToCreate = getPaths(structure);

        if (window.electronAPI) {
            const result = await window.electronAPI.createStructure({
                destination,
                rootName: generatedName,
                structure: foldersToCreate
            });

            if (result.success) {
                setStatus({ type: 'success', message: `Created: ${result.path}` });
                toast({ title: "Project Created", description: `Folder created at ${result.path}` });
            } else {
                setStatus({ type: 'error', message: result.error });
                toast({ variant: "destructive", title: "Error", description: result.error });
            }
        }
        setIsCreating(false);
    };

    // Template Logic
    const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');

    const openSaveTemplateDialog = () => {
        setTemplateName('');
        setIsSaveTemplateOpen(true);
    };

    const confirmSaveTemplate = () => {
        if (!templateName.trim()) {
            toast({ variant: "destructive", title: "Error", description: "Template name cannot be empty." });
            return;
        }

        // Check for duplicate names
        if (templates.some(t => t.name === templateName.trim())) {
            if (!confirm(`Template "${templateName}" already exists. Overwrite?`)) {
                return;
            }
        }

        const newT = { name: templateName.trim(), structure: JSON.parse(JSON.stringify(structure)) };
        const filtered = templates.filter(t => t.name !== newT.name);
        saveTemplates([...filtered, newT]);

        setIsSaveTemplateOpen(false);
        toast({ title: "Template Saved", description: `Saved "${newT.name}" successfully.` });
    };

    const saveTemplate = openSaveTemplateDialog;

    const loadTemplate = (t) => {
        if (confirm(`Load template "${t.name}"? This will overwrite current structure.`)) {
            setStructure(t.structure);
            toast({ title: "Template Loaded", description: `Loaded "${t.name}" successfully.` });
        }
    };

    const deleteTemplate = (name) => {
        if (confirm(`Delete template "${name}"?`)) {
            saveTemplates(templates.filter(x => x.name !== name));
        }
    };

    const handleIngestRequest = (node) => {
        if (!destination) {
            toast({ variant: "destructive", title: "No Destination", description: "Please select a root destination first." });
            return;
        }

        // Construct path from node ID. 
        // Note: Node IDs are paths relative to the root like "01_FOOTAGE/INTERVIEWS"
        // But if IDs were rebuilt with "parent/child", we can trust ID mostly.
        // However, we need to append it to the `generatedName` inside `destination`.
        // Wait, the folders are not created yet? Or are they?
        // This copy module copy files TO the destination.
        // If the project is not created yet, we can still aim at the path.

        // Let's assume the user wants to copy to:
        // [Destination Parent] / [Generated Root Name] / [Node Path]
        const fullPath = `${destination}/${generatedName}/${node.id}`;

        setIngestDestination(fullPath);
        setActiveTab('ingest');
        toast({ title: "Ingest Target Set", description: `Selected: ${node.name}` });
    };

    return (
        <div className="flex h-screen w-full font-sans overflow-hidden selection:bg-primary/30">
            <div className="titlebar fixed top-0 left-0 z-50 pointer-events-none flex items-center">
                <img src="icon-small.png" className="w-5 h-5 mr-3 rounded-md shadow-sm" alt="App Icon" />
                <span className="opacity-80 font-bold tracking-wide">HATCH</span>
                <span className="text-primary mx-2">///</span>
                <span className="opacity-50 font-normal text-xs tracking-wider">PROJECT INITIALIZER</span>
            </div>
            <Toaster />

            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

            {activeTab === 'project' && (
                <>
                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-white/10">
                            <DialogHeader>
                                <DialogTitle>Settings</DialogTitle>
                            </DialogHeader>
                            <SettingsPanel
                                clients={clients} saveClients={saveClients}
                                namingStructure={namingStructure} saveNamingStructure={saveNamingStructure}
                            />
                        </DialogContent>
                    </Dialog>

                    <div className="w-[420px] bg-card/30 backdrop-blur-2xl border-r border-white/5 flex flex-col pt-14 shadow-2xl z-20 relative">
                        {/* Decorative glow */}
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />

                        <ScrollArea className="flex-1 relative">
                            <div className="p-8 space-y-8">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/20 shrink-0">
                                                <Layers className="h-5 w-5 text-primary" />
                                            </div>
                                            Project Identity
                                        </h2>
                                        <p className="text-xs text-muted-foreground pl-1">Define your campaign parameters</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="hover:bg-white/5">
                                        <SettingsIcon className="w-5 h-5 text-muted-foreground" />
                                    </Button>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label>Project Type</Label>
                                        <Select value={projectType} onValueChange={setProjectType}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {PROJECT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Client Name</Label>
                                        <Popover open={isClientOpen} onOpenChange={setIsClientOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-between", !clientName && "text-muted-foreground")}>
                                                    {clientName || "Select client..."}
                                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[350px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search client..." />
                                                    <CommandList>
                                                        <CommandEmpty>No client found.</CommandEmpty>
                                                        <CommandGroup>
                                                            <CommandItem value="none_clear" onSelect={() => { setClientName(""); setIsClientOpen(false); }}>None (Clear)</CommandItem>
                                                            {clients.map((client) => (
                                                                <CommandItem key={client} value={client.toLowerCase()} onSelect={() => { setClientName(client); setIsClientOpen(false); }}>
                                                                    <Check className={cn("mr-2 h-4 w-4", clientName === client ? "opacity-100" : "opacity-0")} />
                                                                    {client}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Project Name <span className="text-primary">*</span></Label>
                                        <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Campaign" />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Date (DD-MM-YY)</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date ? format(date, "dd-MM-yy") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="pt-6 border-t">
                                    <Label className="mb-2 block">Destination</Label>
                                    <Button variant="outline" onClick={async () => {
                                        if (window.electronAPI) {
                                            const path = await window.electronAPI.selectDirectory();
                                            if (path) setDestination(path);
                                        }
                                    }} className="w-full justify-start text-muted-foreground overflow-hidden">
                                        {destination ? <span className="truncate text-foreground font-mono text-xs">{destination}</span> : "Select Folder..."}
                                    </Button>
                                </div>
                            </div>
                        </ScrollArea>

                        <div className="p-6 bg-card/40 border-t border-white/5 shadow-2xl z-30 backdrop-blur-md">
                            <div className="mb-4 space-y-2">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Generated Root Name</Label>
                                <div className="p-4 bg-black/40 rounded-lg border border-white/5 text-sm font-mono break-all text-primary shadow-inner">
                                    <span className="select-all">{generatedName}</span>
                                </div>
                            </div>

                            <Button onClick={handleCreate} disabled={isCreating} className="w-full h-12 text-md font-semibold shadow-[0_0_20px_rgba(var(--primary),0.2)] hover:shadow-[0_0_30px_rgba(var(--primary),0.4)] transition-all duration-300">
                                {isCreating ? 'Accessing File System...' : 'Initialize Project'}
                                {!isCreating && <ArrowRight className="ml-2 h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Save Template</DialogTitle>
                                <DialogDescription>
                                    Enter a name for your new template.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-2">
                                <Input
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="Template Name"
                                    onKeyDown={(e) => { if (e.key === 'Enter') confirmSaveTemplate(); }}
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsSaveTemplateOpen(false)}>Cancel</Button>
                                <Button onClick={confirmSaveTemplate}>Save Template</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <StructureEditor
                        structure={structure}
                        setStructure={setStructure}
                        handleToggle={handleToggle}
                        templates={templates}
                        loadTemplate={loadTemplate}
                        saveTemplate={saveTemplate}
                        deleteTemplate={deleteTemplate}
                        onIngest={handleIngestRequest}
                    />
                </>
            )}

            {activeTab === 'ingest' && <IngestView initialDestination={ingestDestination} />}
        </div>
    )
}

function IngestView({ initialDestination }) {
    const { toast } = useToast();
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState(initialDestination || '');
    const [projectName, setProjectName] = useState('');
    const [isCopying, setIsCopying] = useState(false);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        if (initialDestination) {
            setDestination(initialDestination);
        }
    }, [initialDestination]);

    const fetchLogs = async () => {
        if (window.electronAPI) {
            const l = await window.electronAPI.getLogs();
            setLogs(l);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleCopy = async () => {
        if (!source || !destination) {
            toast({ variant: "destructive", title: "Missing Paths", description: "Select both source and destination." });
            return;
        }

        setIsCopying(true);
        if (window.electronAPI) {
            toast({ title: "Copy Started", description: "This may take a while for large footage..." });
            const res = await window.electronAPI.copyFiles({ source, destination, projectName });
            setIsCopying(false);

            if (res.success) {
                toast({ title: "Copy Complete", description: res.log.verified ? "Verified Successfully" : "WARNING: File count/size mismatch." });
                fetchLogs();
            } else {
                toast({ variant: "destructive", title: "Copy Failed", description: res.error });
            }
        }
    };

    return (
        <div className="flex-1 flex flex-col pt-14 px-8 pb-8 gap-8 overflow-hidden">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold flex items-center gap-3 text-white tracking-tight">
                        <HardDrive className="h-8 w-8 text-primary" />
                        Footage Ingest
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Secure Media Offloading & Verification</p>
                </div>
            </div>

            <div className="grid grid-cols-[350px_1fr] gap-8 h-full overflow-hidden">
                {/* Control Panel */}
                <Card className="bg-card/30 backdrop-blur-xl border-white/5 p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Project / Shoot Name</Label>
                            <Input placeholder="e.g. Day 01 Shoot" value={projectName} onChange={e => setProjectName(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label>Source Media</Label>
                            <Button variant="outline" className="w-full justify-start text-xs truncate" onClick={async () => {
                                const p = await window.electronAPI.selectDirectory();
                                if (p) setSource(p);
                            }}>
                                {source ? source : "Select Source..."}
                            </Button>
                        </div>

                        <div className="flex justify-center">
                            <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
                        </div>

                        <div className="space-y-2">
                            <Label>Destination Backup</Label>
                            <Button variant="outline" className="w-full justify-start text-xs truncate" onClick={async () => {
                                const p = await window.electronAPI.selectDirectory();
                                if (p) setDestination(p);
                            }}>
                                {destination ? destination : "Select Dest..."}
                            </Button>
                        </div>

                        <Button size="lg" className="w-full mt-4" disabled={isCopying} onClick={handleCopy}>
                            {isCopying ? <RefreshCw className="animate-spin mr-2" /> : <Upload className="mr-2" />}
                            {isCopying ? "Copying..." : "Start Ingest"}
                        </Button>
                    </div>
                </Card>

                {/* Log View */}
                <Card className="bg-card/30 backdrop-blur-xl border-white/5 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="font-semibold flex items-center gap-2">
                            <HistoryIcon className="w-4 h-4 text-primary" />
                            Ingest Logs
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => { if (window.electronAPI) window.electronAPI.clearLogs().then(fetchLogs); }}>
                            Clear History
                        </Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-white/5 text-muted-foreground sticky top-0 backdrop-blur-md">
                                    <tr>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Project</th>
                                        <th className="px-4 py-3">Time</th>
                                        <th className="px-4 py-3">Files</th>
                                        <th className="px-4 py-3">Size</th>
                                        <th className="px-4 py-3">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {logs.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No ingestion logs found.</td></tr>
                                    )}
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                {log.verified ?
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/20">Verified</span>
                                                    :
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/20">Mismatch</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 font-medium">{log.projectName}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
                                            <td className="px-4 py-3 font-mono">{log.filesCount}</td>
                                            <td className="px-4 py-3 font-mono">{(log.totalSize / (1024 * 1024)).toFixed(2)} MB</td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={`${log.source} -> ${log.destination}`}>
                                                {log.source.split('/').pop()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
}

function StructureEditor({ structure, setStructure, handleToggle, templates, loadTemplate, saveTemplate, deleteTemplate, onIngest }) {

    // Insert a new node at a specific path and index
    const handleInsert = (targetParentId, insertIndex) => {
        const newNode = {
            id: `TEMP_${Date.now()}`,
            name: "UNTITLED",
            checked: true,
            isEditing: true,
            children: []
        };

        if (!targetParentId) {
            // Root insert
            const newStruct = [...structure];
            newStruct.splice(insertIndex, 0, newNode);
            setStructure(newStruct);
        } else {
            // Child insert
            const update = (nodes) => {
                return nodes.map(node => {
                    if (node.id === targetParentId) {
                        const newChildren = node.children ? [...node.children] : [];
                        newChildren.splice(insertIndex, 0, newNode);
                        return { ...node, children: newChildren };
                    }
                    if (node.children) {
                        return { ...node, children: update(node.children) };
                    }
                    return node;
                });
            };
            setStructure(update(structure));
        }
    };

    const handleDelete = (id) => {
        const remove = (nodes) => nodes.filter(n => {
            if (n.id === id) return false;
            if (n.children) n.children = remove(n.children);
            return true;
        });

        let newStruct = remove(structure);
        newStruct = reindexRootFolders(newStruct);
        setStructure(newStruct);
    };

    const handleStartEdit = (id) => {
        const update = (nodes) => nodes.map(node => {
            if (node.id === id) {
                return { ...node, isEditing: true };
            }
            if (node.children) return { ...node, children: update(node.children) };
            return node;
        });
        setStructure(update(structure));
    };

    const handleConfirmEdit = (id, rawName) => {
        // Validation
        if (!rawName || !rawName.trim()) {
            handleDelete(id);
            return;
        }

        const validName = sanitizeNodeName(rawName);

        // Update name in tree
        const update = (nodes) => nodes.map(node => {
            if (node.id === id) {
                return { ...node, name: validName, isEditing: false };
            }
            if (node.children) return { ...node, children: update(node.children) };
            return node;
        });

        let newStruct = update(structure);
        newStruct = reindexRootFolders(newStruct);
        setStructure(newStruct);
    };

    return (
        <div className="flex-1 relative flex flex-col h-full overflow-hidden">
            {/* Background graphics/glows */}
            <div className="absolute inset-0 bg-transparent z-0 pointer-events-none" />

            <div className="pt-8 px-8 pb-8 h-full flex flex-col max-w-4xl mx-auto w-full relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-bold flex items-center gap-3 text-white tracking-tight">
                            Directory Structure
                        </h2>
                        <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-xs text-muted-foreground w-fit">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            Live Preview
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Templates UI Moved Here */}
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 px-3 text-xs bg-black/40 border-white/10 hover:bg-white/10 hover:text-white transition-all">
                                        Load Template
                                        <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-2" align="end">
                                    {templates && templates.length === 0 && <p className="text-muted-foreground text-center text-xs py-4">No templates</p>}
                                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                                        {templates && templates.map(t => (
                                            <div key={t.name} className="flex justify-between items-center text-xs p-2 hover:bg-muted rounded group cursor-pointer" onClick={() => loadTemplate(t)}>
                                                <span className="truncate flex-1 font-medium">{t.name}</span>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.name); }}>
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <Button variant="secondary" size="icon" className="h-9 w-9 bg-primary/20 hover:bg-primary/40 text-primary border border-primary/20" onClick={saveTemplate} title="Save current as template">
                                <Save className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="h-1 bg-white/10 w-[1px] h-12 mx-2"></div>
                        <div className="h-20 w-20 rounded-xl overflow-hidden shadow-lg border border-primary/20 bg-black/40 shrink-0">
                            <img src="header-image.jpg" className="w-full h-full object-contain" alt="Header" />
                        </div>
                    </div>
                </div>

                <Card className="flex-1 overflow-hidden border-white/5 bg-black/20 backdrop-blur-md shadow-2xl rounded-xl">
                    <ScrollArea className="h-full">
                        <div className="p-8 pb-24">
                            <NodeList
                                nodes={structure}
                                parentId={null}
                                onInsert={handleInsert}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                                onConfirmEdit={handleConfirmEdit}
                                onStartEdit={handleStartEdit}
                                onIngest={onIngest}
                            />
                        </div>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    )
}

// ... (StructureEditor signature update in next step)

function NodeList({ nodes, parentId, onInsert, onDelete, onToggle, onConfirmEdit, onStartEdit, onIngest, level = 0 }) {
    if (!nodes) return null;

    return (
        <div className="flex flex-col">
            {nodes.map((node, index) => (
                <React.Fragment key={node.id || index}>
                    <InsertZone level={level} onInsert={() => onInsert(parentId, index)} />
                    <FolderNode
                        node={node}
                        parentId={parentId}
                        level={level}
                        onDelete={onDelete}
                        onToggle={onToggle}
                        onInsert={onInsert}
                        onConfirmEdit={onConfirmEdit}
                        onStartEdit={onStartEdit}
                        onIngest={onIngest}
                    />
                </React.Fragment>
            ))}
            {/* Final insertion point */}
            <InsertZone level={level} onInsert={() => onInsert(parentId, nodes.length)} isLast />
        </div>
    );
}

function InsertZone({ onInsert, level, isLast }) {
    const isSub = level > 0;
    return (
        <div
            className={cn(
                "h-4 -my-2 relative group z-30 flex items-center justify-center cursor-pointer transition-all",
                isLast ? "h-6 my-0" : ""
            )}
            style={{ marginLeft: `${level * 20}px` }}
            onClick={(e) => {
                e.stopPropagation();
                onInsert();
            }}
        >
            <div className={cn(
                "h-[2px] transition-colors rounded-full",
                isSub ? "w-[85%] bg-[#bac1ff]/0 group-hover:bg-[#bac1ff]" : "w-full bg-blue-500/0 group-hover:bg-blue-500"
            )} />

            <div className={cn(
                "absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-sm transform scale-50 group-hover:scale-100 transition-all",
                isSub ? "bg-[#bac1ff] text-white" : "bg-blue-500 text-white"
            )}>
                <Plus className="w-3 h-3" />
            </div>
        </div>
    );
}

function FolderNode({ node, parentId, onDelete, onToggle, onInsert, onConfirmEdit, onStartEdit, onIngest, level }) {
    const [isOpen, setIsOpen] = useState(true);
    const [isHovered, setIsHovered] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    const isSub = level > 0;

    const [editName, setEditName] = useState(node.name === "UNTITLED" ? "" : node.name);
    const inputRef = useRef(null);

    useEffect(() => {
        if (node.isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [node.isEditing]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onConfirmEdit(node.id, editName);
        } else if (e.key === 'Escape') {
            onConfirmEdit(node.id, ""); // Cancel -> Delete
        }
        e.stopPropagation();
    };

    const handleBlur = () => {
        onConfirmEdit(node.id, editName);
    };

    // Editing View
    if (node.isEditing) {
        return (
            <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/50 my-1 animate-in fade-in zoom-in-95 duration-200" style={{ marginLeft: `${level * 20}px` }}>
                <Folder className="h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    value={editName}
                    onChange={e => setEditName(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    className="h-7 text-xs font-mono uppercase"
                    placeholder="FOLDER_NAME"
                />
            </div>
        );
    }

    // Normal View
    return (
        <div className="select-none text-sm relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <div
                className={cn(
                    "flex items-center gap-3 py-1 px-3 rounded-lg transition-all group z-20 relative",
                    node.checked
                        ? ""
                        : "opacity-60"
                )}
                style={{ paddingLeft: `${level * 24 + 12}px` }}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className={cn("h-6 w-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors", !hasChildren && "invisible")}
                >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                <div className="scale-110">
                    <Checkbox checked={node.checked} onCheckedChange={(c) => onToggle(node.id, c)} className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                </div>

                <div className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onClick={(e) => { e.stopPropagation(); onStartEdit(node.id); }}>
                    <Folder className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        node.checked
                            ? "fill-primary text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                            : "fill-muted text-muted-foreground"
                    )} />
                    <span className={cn(
                        "font-mono truncate tracking-tight transition-colors hover:underline hover:text-primary",
                        node.checked
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground decoration-line-through"
                    )}>
                        {node.name}
                    </span>
                </div>

                {isHovered && (
                    <div className="flex items-center gap-1 ml-auto animate-in fade-in duration-200">
                        {/* Ingest Button */}
                        <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-500/20 hover:text-blue-500 rounded-full"
                            title="Ingest footage here"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onIngest) onIngest(node);
                            }}
                        >
                            <HardDrive className="h-3.5 w-3.5" />
                        </Button>

                        {/* Add Child Button */}
                        <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10 hover:text-primary rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                onInsert(node.id, 0); // Insert at 0 index of this parent
                                setIsOpen(true); // Ensure open to see new item
                            }}
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>

                        {/* Delete Button */}
                        <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/20 hover:text-red-500 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this folder and all contents?")) onDelete(node.id);
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {hasChildren && isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pl-4 ml-3 border-l border-white/10">
                            <NodeList
                                nodes={node.children}
                                parentId={node.id}
                                onInsert={onInsert}
                                onDelete={onDelete}
                                onToggle={onToggle}
                                onConfirmEdit={onConfirmEdit}
                                onStartEdit={onStartEdit}
                                onIngest={onIngest}
                                level={level + 1}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SettingsPanel({ clients, saveClients, namingStructure, saveNamingStructure }) {
    const [newClient, setNewClient] = useState("");
    const [sheetUrl, setSheetUrl] = useState("");

    // Clients
    const addClient = () => {
        if (!newClient.trim()) return;
        const clean = sanitizeClient(newClient);
        if (!clients.includes(clean)) saveClients([...clients, clean].sort());
        setNewClient("");
    };
    const removeClient = (c) => saveClients(clients.filter(x => x !== c));

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        if (window.electronAPI) {
            const names = await window.electronAPI.parseCSV(text);
            const merged = Array.from(new Set([...clients, ...names.map(sanitizeClient)]));
            saveClients(merged.sort());
        }
    };

    const handleInfoSheet = async () => {
        if (!sheetUrl) return;
        if (window.electronAPI) {
            const res = await window.electronAPI.fetchGoogleSheet(sheetUrl);
            if (Array.isArray(res)) {
                const merged = Array.from(new Set([...clients, ...res.map(sanitizeClient)]));
                saveClients(merged.sort());
                setSheetUrl("");
            } else {
                alert("Failed to fetch: " + JSON.stringify(res));
            }
        }
    };

    const moveToken = (index, direction) => {
        if (!namingStructure) return;
        const newOrder = [...namingStructure];
        if (direction === 'up') {
            if (index === 0) return;
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        } else {
            if (index === newOrder.length - 1) return;
            [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        }
        saveNamingStructure(newOrder);
    };

    return (
        <div className="w-full space-y-8">
            {/* Naming Structure Config */}
            <div className="space-y-4">
                <h3 className="font-medium text-sm">Folder Naming Convention</h3>
                <div className="p-4 border rounded-md bg-muted/20 space-y-2">
                    <p className="text-xs text-muted-foreground mb-4">Rearrange the tokens to change the folder name format.</p>
                    {namingStructure && namingStructure.map((token, index) => (
                        <div key={token} className="flex items-center justify-between p-2 bg-card border rounded shadow-sm">
                            <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-1 rounded">{token}</span>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} onClick={() => moveToken(index, 'up')}>
                                    <ChevronDown className="w-3 h-3 rotate-180" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={index === namingStructure.length - 1} onClick={() => moveToken(index, 'down')}>
                                    <ChevronDown className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-medium text-sm">Clients Management</h3>
                <div className="flex gap-2">
                    <Input value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="Add Client Name" />
                    <Button onClick={addClient}><Plus className="w-4 h-4" /></Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle className="text-sm">Import CSV</CardTitle></CardHeader>
                        <CardContent>
                            <Input type="file" accept=".csv" onChange={handleFileUpload} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-sm">Google Sheets</CardTitle></CardHeader>
                        <CardContent className="flex gap-2">
                            <Input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="Sheet URL" />
                            <Button onClick={handleInfoSheet}><RefreshCw className="w-4 h-4" /></Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="border rounded-md p-4 h-[300px] overflow-y-auto space-y-2">
                    {clients.map(c => (
                        <div key={c} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                            <span>{c}</span>
                            <Button variant="ghost" size="icon" onClick={() => removeClient(c)} className="h-6 w-6 hover:text-red-500"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
