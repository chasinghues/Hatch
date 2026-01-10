import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layers, Folder, FolderOpen, FileVideo, User, Calendar as CalendarIcon, Upload, ArrowRight, Check, AlertCircle, ChevronDown, ChevronRight, Settings as SettingsIcon, Plus, Trash2, Edit2, Download, Save, RefreshCw, X, HardDrive, History as HistoryIcon, ChevronsUpDown } from 'lucide-react';

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

import ProjectsHub from "@/components/ProjectsHub"
import defaultTemplates from "@/data/templates.json";
import defaultProjectTypes from "@/data/projectTypes.json"
import { NodeList } from "@/components/DirectoryStructure"

// --- Constants ---
const PROJECT_TYPES_GIST_URL = "https://gist.githubusercontent.com/chasinghues/02988fe587552bd2ade5fc1fbdbb4cc0/raw/1a2a006a30aa63b1971ecd0adf607cec6ad21eb6/Project%2520Types";
const TEMPLATES_GIST_URL = "https://gist.githubusercontent.com/chasinghues/8646b4a51a39315dada44b80853367ed/raw/TemplateTypes.json";

const DEFAULT_TEMPLATE = defaultTemplates.defaults.find(t => t.isDefault) || defaultTemplates.defaults[0];
const INITIAL_STRUCTURE = DEFAULT_TEMPLATE.structure;
const INITIAL_TEMPLATE_NAME = DEFAULT_TEMPLATE.name;

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
        { id: 'projects', icon: FolderOpen, label: 'Projects' },
    ];

    return (
        <div className="w-[60px] bg-black/20 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-6 gap-4 z-50 pt-20">
            {items.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group relative",
                        activeTab === item.id
                            ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                            : "text-muted-foreground hover:bg-white/5 hover:text-white"
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
    // Data State
    const [projectType, setProjectType] = useState('Commercial');
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

    // Project Types State
    const [projectTypesList, setProjectTypesList] = useState(defaultProjectTypes);
    const [isProjectTypeOpen, setIsProjectTypeOpen] = useState(false);

    const [selectedTemplateName, setSelectedTemplateName] = useState(INITIAL_TEMPLATE_NAME);

    // Filter Search States
    const [clientSearch, setClientSearch] = useState("");
    const [typeSearch, setTypeSearch] = useState("");

    const syncGistData = async (silent = false, baseTemplates = null) => {
        if (!window.electronAPI) return;
        if (!silent) toast({ title: "Syncing...", description: "Fetching latest templates from Gist." });

        if (TEMPLATES_GIST_URL) {
            try {
                const res = await fetch(`${TEMPLATES_GIST_URL}?t=${Date.now()}`);
                const data = await res.json();
                if (data && data.defaults) {
                    const gistTemplates = data.defaults;
                    let hasGistChanges = false;

                    // Use provided base or current state
                    const current = [...(baseTemplates || templates)];

                    gistTemplates.forEach(t => {
                        const existing = current.find(m => m.name === t.name);
                        if (!existing) {
                            current.push(t);
                            hasGistChanges = true;
                        } else if (t.isDefault) {
                            // Enforce cloud default
                            if (!existing.isDefault) {
                                current.forEach(m => { if (m.name !== t.name) delete m.isDefault; });
                                existing.isDefault = true;
                                hasGistChanges = true;
                            }
                            // Always update structure from gist for the default one for debugging
                            if (JSON.stringify(existing.structure) !== JSON.stringify(t.structure)) {
                                existing.structure = t.structure;
                                hasGistChanges = true;
                            }
                        }
                    });

                    if (hasGistChanges) {
                        setTemplates(current);
                        window.electronAPI.storeSet('templates', current);
                        const newDefault = current.find(t => t.isDefault);
                        if (newDefault) {
                            setStructure(newDefault.structure);
                            setSelectedTemplateName(newDefault.name);
                        }
                        if (!silent) toast({ title: "Cloud Sync Complete", description: "Templates updated from Gist." });
                    } else {
                        if (!silent) toast({ title: "Up to Date", description: "Templates already match Cloud Gist." });
                    }
                }
            } catch (err) {
                console.error("Gist templates fetch failed:", err);
                if (!silent) toast({ variant: "destructive", title: "Sync Failed", description: "Failed to reload Gist." });
            }
        }
    };

    // Unified Data Loading Logic
    useEffect(() => {
        const loadInitialData = async () => {
            if (!window.electronAPI) return;

            // 1. Load Clients & Naming
            const [savedClients, savedNaming] = await Promise.all([
                window.electronAPI.storeGet('clients'),
                window.electronAPI.storeGet('namingStructure')
            ]);
            if (savedClients && Array.isArray(savedClients)) setClients(savedClients);
            if (savedNaming && Array.isArray(savedNaming)) setNamingStructure(savedNaming);

            // 2. Load and Merge Templates
            const savedTemplates = await window.electronAPI.storeGet('templates');
            const localDefaults = defaultTemplates.defaults;
            let currentTemplates = (savedTemplates && Array.isArray(savedTemplates)) ? savedTemplates : [];

            // Merge local defaults into currentTemplates if missing
            let localMergeChanges = false;
            localDefaults.forEach(d => {
                const existing = currentTemplates.find(t => t.name === d.name);
                if (!existing) {
                    currentTemplates.push(d);
                    localMergeChanges = true;
                } else if (d.isDefault && !existing.isDefault) {
                    currentTemplates.forEach(m => { if (m.name !== d.name) delete m.isDefault; });
                    existing.isDefault = true;
                    localMergeChanges = true;
                }
            });

            // Initial selection
            const localDefaultT = currentTemplates.find(t => t.isDefault) || currentTemplates.find(t => t.name === INITIAL_TEMPLATE_NAME) || currentTemplates[0];
            if (localDefaultT) {
                setStructure(localDefaultT.structure);
                setSelectedTemplateName(localDefaultT.name);
            }
            setTemplates(currentTemplates);
            if (localMergeChanges) window.electronAPI.storeSet('templates', currentTemplates);

            // 3. Load Project Types
            const savedTypes = await window.electronAPI.storeGet('projectTypes');
            if (savedTypes && Array.isArray(savedTypes)) {
                const sortedTypes = savedTypes.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                setProjectTypesList(sortedTypes);
            }

            // 4. Fetch Gist Updates (Asynchronously)
            syncGistData(true, currentTemplates);

            if (PROJECT_TYPES_GIST_URL) {
                fetch(PROJECT_TYPES_GIST_URL)
                    .then(res => res.json())
                    .then(data => {
                        if (Array.isArray(data)) {
                            setProjectTypesList(prev => {
                                const merged = Array.from(new Set([...prev, ...data]));
                                const sorted = merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                                window.electronAPI.storeSet('projectTypes', sorted);
                                return sorted;
                            });
                        }
                    })
                    .catch(err => console.error("Gist project types fetch failed:", err));
            }
        };

        loadInitialData();
    }, []);

    // Ingest specific State
    const [ingestDestination, setIngestDestination] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);

    // Re-initialization Logic
    useEffect(() => {
        if (isInitialized) {
            setIsInitialized(false);
        }
    }, [projectName, clientName, projectType, date]);

    const saveClients = (newClients) => {
        const sorted = Array.from(new Set(newClients)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setClients(sorted);
        if (window.electronAPI) window.electronAPI.storeSet('clients', sorted);
    };

    const saveTemplates = (newTemplates) => {
        setTemplates(newTemplates);
        if (window.electronAPI) window.electronAPI.storeSet('templates', newTemplates);
    };

    const saveNamingStructure = (newStructure) => {
        setNamingStructure(newStructure);
        if (window.electronAPI) window.electronAPI.storeSet('namingStructure', newStructure);
    };

    const saveProjectTypes = (newTypes) => {
        const sorted = Array.from(new Set(newTypes)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setProjectTypesList(sorted);
        if (window.electronAPI) window.electronAPI.storeSet('projectTypes', sorted);
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
                structure: foldersToCreate,
                metadata: {
                    projectName,
                    clientName,
                    projectType,
                    date: date ? date.toISOString() : new Date().toISOString()
                }
            });

            if (result.success) {
                setStatus({ type: 'success', message: `Created: ${result.path}` });
                toast({ title: "Project Initialized", description: `Folder created at ${result.path}` });
                setIsInitialized(true);
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
            setSelectedTemplateName(t.name);
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
        setIngestDestination(fullPath);
        setActiveTab('projects');
        toast({ title: "Ingest Target Set", description: `Selected: ${node.name}` });
    };

    const handleExportTemplate = async () => {
        if (window.electronAPI) {
            // Save current structure
            const currentStructure = {
                name: "Custom Export",
                structure: structure
            };
            const res = await window.electronAPI.saveJSON({
                title: "Export Template",
                defaultPath: "template.json",
                data: currentStructure
            });
            if (res && res.success) {
                toast({ title: "Template Exported", description: `Saved to ${res.filePath}` });
            } else if (res && res.error) {
                toast({ variant: "destructive", title: "Export Failed", description: res.error });
            }
        }
    };

    const handleImportTemplate = async () => {
        if (window.electronAPI) {
            const res = await window.electronAPI.readJSON();
            if (res && res.success) {
                const data = res.data;
                // Validation: check for structure array or if it's the structure itself
                let newT = null;
                if (Array.isArray(data)) {
                    // Assume it's a raw structure array
                    newT = { name: `Imported ${format(new Date(), 'HH:mm:ss')}`, structure: data };
                } else if (data.structure && Array.isArray(data.structure)) {
                    // Assume it's our template object
                    newT = { name: data.name || `Imported ${format(new Date(), 'HH:mm:ss')}`, structure: data.structure };
                }

                if (newT) {
                    // Verify if name exists
                    let finalName = newT.name;
                    if (templates.some(t => t.name === finalName)) {
                        finalName = `${finalName} (Copy)`;
                    }
                    newT.name = finalName;

                    const newTemplates = [...templates, newT];
                    saveTemplates(newTemplates);
                    toast({ title: "Template Imported", description: `Added "${finalName}" to your templates.` });
                } else {
                    toast({ variant: "destructive", title: "Invalid File", description: "The JSON does not look like a valid Hatch template." });
                }
            } else if (res && res.error) {
                toast({ variant: "destructive", title: "Import Failed", description: res.error });
            }
        }
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

            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isInitialized={isInitialized} />

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
                                onImportTemplate={handleImportTemplate}
                                onExportTemplate={handleExportTemplate}
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
                                        <Popover open={isProjectTypeOpen} onOpenChange={setIsProjectTypeOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={isProjectTypeOpen}
                                                    className="w-full justify-between"
                                                >
                                                    {projectType || "Select type..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[380px] p-0">
                                                <Command>
                                                    <CommandInput
                                                        placeholder="Search type..."
                                                        onValueChange={setTypeSearch}
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty className="p-0">
                                                            <div className="p-2 border-t border-white/5">
                                                                <Button
                                                                    variant="ghost"
                                                                    className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10 gap-2 h-9 px-2 text-sm"
                                                                    onClick={() => {
                                                                        const newType = typeSearch.trim();
                                                                        if (newType) {
                                                                            saveProjectTypes([...projectTypesList, newType]);
                                                                            setProjectType(newType);
                                                                            setIsProjectTypeOpen(false);
                                                                            setTypeSearch("");
                                                                        }
                                                                    }}
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                    Add "{typeSearch}"
                                                                </Button>
                                                            </div>
                                                        </CommandEmpty>
                                                        <CommandGroup className="max-h-[200px] overflow-y-auto">
                                                            {projectTypesList.map((type) => (
                                                                <CommandItem
                                                                    key={type}
                                                                    value={type}
                                                                    onSelect={() => {
                                                                        setProjectType(type);
                                                                        setIsProjectTypeOpen(false);
                                                                        setTypeSearch("");
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            projectType === type ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {type}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
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
                                                    <CommandInput
                                                        placeholder="Search client..."
                                                        onValueChange={setClientSearch}
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty className="p-0">
                                                            <div className="p-2 border-t border-white/5">
                                                                <Button
                                                                    variant="ghost"
                                                                    className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10 gap-2 h-9 px-2 text-sm"
                                                                    onClick={() => {
                                                                        const clean = sanitizeClient(clientSearch);
                                                                        if (clean) {
                                                                            saveClients([...clients, clean]);
                                                                            setClientName(clean);
                                                                            setIsClientOpen(false);
                                                                            setClientSearch("");
                                                                        }
                                                                    }}
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                    Add "{clientSearch}"
                                                                </Button>
                                                            </div>
                                                        </CommandEmpty>
                                                        <CommandGroup className="max-h-[250px] overflow-y-auto">
                                                            <CommandItem value="none_clear" onSelect={() => { setClientName(""); setIsClientOpen(false); setClientSearch(""); }}>None (Clear)</CommandItem>
                                                            {clients.map((client) => (
                                                                <CommandItem
                                                                    key={client}
                                                                    value={client}
                                                                    onSelect={() => {
                                                                        setClientName(client);
                                                                        setIsClientOpen(false);
                                                                        setClientSearch("");
                                                                    }}
                                                                >
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

                            <Button onClick={handleCreate} disabled={isCreating || isInitialized} className="w-full h-12 text-md font-semibold shadow-[0_0_20px_rgba(var(--primary),0.2)] hover:shadow-[0_0_30px_rgba(var(--primary),0.4)] transition-all duration-300">
                                {isCreating ? 'Accessing File System...' : isInitialized ? 'Initialized' : 'Initialize Project'}
                                {!isCreating && !isInitialized && <ArrowRight className="ml-2 h-4 w-4" />}
                                {isInitialized && <Check className="ml-2 h-4 w-4" />}
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
                        selectedTemplateName={selectedTemplateName}
                        loadTemplate={loadTemplate}
                        saveTemplate={saveTemplate}
                        deleteTemplate={deleteTemplate}
                        syncGistData={syncGistData}
                        onIngest={isInitialized ? handleIngestRequest : null}
                    />
                </>
            )}

            {activeTab === 'projects' && (
                <ProjectsHub
                    initialDestination={ingestDestination}
                    initialProjectContext={{
                        name: projectName,
                        client: clientName,
                        type: projectType,
                        date: date ? date.toISOString() : new Date().toISOString(),
                        path: `${destination}/${generatedName}`
                    }}
                    onBack={() => setActiveTab('project')}
                />
            )}

            {/* Developer Footer */}
            <div className="fixed bottom-3 right-4 z-50 pointer-events-none select-none">
                <div className="text-[10px] text-white/20 font-mono tracking-widest backdrop-blur-sm px-2 py-1 rounded-full border border-transparent hover:border-white/5 hover:bg-black/40 hover:text-white/60 transition-all duration-500 pointer-events-auto cursor-default">
                    Made by <span
                        className="hover:text-primary cursor-pointer hover:underline"
                        onClick={() => window.electronAPI ? window.electronAPI.openExternal("https://github.com/chasinghues/Hatch") : window.open("https://github.com/chasinghues/Hatch", "_blank")}
                    >
                        Arjun Sreekumar
                    </span>
                </div>
            </div>
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

function StructureEditor({ structure, setStructure, handleToggle, templates, selectedTemplateName, loadTemplate, saveTemplate, deleteTemplate, syncGistData, onIngest }) {

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
                                    <Button variant="outline" size="sm" className="h-9 px-3 text-xs bg-black/40 border-white/10 text-white hover:bg-white/5 transition-all font-semibold">
                                        <div className="flex items-center gap-2">
                                            <Folder className="w-3 h-3" />
                                            {selectedTemplateName}
                                        </div>
                                        <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-2 bg-[#121212] border-white/10" align="end">
                                    {templates && templates.length === 0 && <p className="text-muted-foreground text-center text-xs py-4">No templates</p>}
                                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                                        {templates && templates.map(t => (
                                            <div
                                                key={t.name}
                                                className={cn(
                                                    "flex justify-between items-center text-xs p-2 hover:bg-white/5 rounded group cursor-pointer transition-colors",
                                                    selectedTemplateName === t.name ? "bg-white/10 text-white border border-white/10" : "text-white/60"
                                                )}
                                                onClick={() => loadTemplate(t)}
                                            >
                                                <div className="flex items-center gap-2 truncate flex-1">
                                                    {selectedTemplateName === t.name && <Check className="w-3 h-3 text-white" />}
                                                    <span className="truncate font-medium">{t.name}</span>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.name); }}>
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            {import.meta.env.DEV && (
                                <Button variant="secondary" size="icon" className="h-9 w-9 bg-white/5 hover:bg-white/10 text-white border border-white/10" onClick={() => syncGistData()} title="Sync with Cloud Gist">
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            )}
                            <Button variant="secondary" size="icon" className="h-9 w-9 bg-white/5 hover:bg-white/10 text-white border border-white/10" onClick={saveTemplate} title="Save current as template">
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



function SettingsPanel({ clients, saveClients, namingStructure, saveNamingStructure, onImportTemplate, onExportTemplate }) {
    const [activeSettingsTab, setActiveSettingsTab] = useState('templates');
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

    const tabs = [
        { id: 'templates', label: 'Templates', icon: Folder },
        { id: 'naming', label: 'Naming Convention', icon: Edit2 },
        { id: 'clients', label: 'Clients', icon: User },
    ];

    return (
        <div className="flex h-[500px] gap-6">
            {/* Sidebar */}
            <div className="w-48 flex flex-col gap-1 pr-4 border-r border-white/5">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSettingsTab(tab.id)}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all text-left",
                            activeSettingsTab === tab.id
                                ? "bg-primary text-primary-foreground font-medium"
                                : "text-muted-foreground hover:bg-white/5 hover:text-white"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2">
                {activeSettingsTab === 'templates' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="space-y-1 mb-6">
                            <h3 className="font-medium">Templates</h3>
                            <p className="text-xs text-muted-foreground">Manage your folder structure templates.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Card onClick={onImportTemplate} className="cursor-pointer hover:bg-muted/50 transition-colors group border-dashed">
                                <CardHeader className="flex flex-col items-center justify-center py-8 space-y-2 text-center">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Upload className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-sm font-medium">Import Template</CardTitle>
                                        <p className="text-xs text-muted-foreground">Load a .json file</p>
                                    </div>
                                </CardHeader>
                            </Card>
                            <Card onClick={onExportTemplate} className="cursor-pointer hover:bg-muted/50 transition-colors group border-dashed">
                                <CardHeader className="flex flex-col items-center justify-center py-8 space-y-2 text-center">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Download className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-sm font-medium">Export Current</CardTitle>
                                        <p className="text-xs text-muted-foreground">Save as .json</p>
                                    </div>
                                </CardHeader>
                            </Card>
                        </div>
                    </div>
                )}

                {activeSettingsTab === 'naming' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="space-y-1 mb-6">
                            <h3 className="font-medium">Naming Convention</h3>
                            <p className="text-xs text-muted-foreground">Customize how project folders are named.</p>
                        </div>

                        <div className="p-1 border rounded-md bg-muted/20 space-y-2">
                            {namingStructure && namingStructure.map((token, index) => (
                                <div key={token} className="flex items-center justify-between p-3 bg-card border rounded shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-1 rounded">{token}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {token === 'CLIENT' ? 'e.g. Nike' :
                                                token === 'PROJECT' ? 'e.g. Summer Campaign' :
                                                    token === 'TYPE' ? 'e.g. Commercial' :
                                                        token === 'DATE' ? 'DD-MM-YY' : ''}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" disabled={index === 0} onClick={() => moveToken(index, 'up')}>
                                            <ChevronDown className="w-4 h-4 rotate-180" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" disabled={index === namingStructure.length - 1} onClick={() => moveToken(index, 'down')}>
                                            <ChevronDown className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeSettingsTab === 'clients' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="space-y-1">
                            <h3 className="font-medium">Clients</h3>
                            <p className="text-xs text-muted-foreground">Manage your client list for quick selection.</p>
                        </div>

                        <div className="flex gap-2">
                            <Input value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="Enter new client name..." className="bg-muted/50" />
                            <Button onClick={addClient}><Plus className="w-4 h-4 mr-2" /> Add</Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-muted/5 border-dashed">
                                <CardHeader className="p-4"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Import CSV</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <Input type="file" accept=".csv" onChange={handleFileUpload} className="h-8 text-xs" />
                                </CardContent>
                            </Card>
                            <Card className="bg-muted/5 border-dashed">
                                <CardHeader className="p-4"><CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sync Google Sheet</CardTitle></CardHeader>
                                <CardContent className="flex gap-2 p-4 pt-0">
                                    <Input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="Sheet URL" className="h-8 text-xs" />
                                    <Button size="sm" variant="secondary" onClick={handleInfoSheet}><RefreshCw className="w-3 h-3" /></Button>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="border rounded-md divide-y divide-white/5 bg-muted/10">
                            {clients.map(c => (
                                <div key={c} className="flex justify-between items-center text-sm p-3 hover:bg-white/5 transition-colors group">
                                    <span className="font-medium">{c}</span>
                                    <Button variant="ghost" size="icon" onClick={() => removeClient(c)} className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
