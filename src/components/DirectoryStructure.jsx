import React, { useState, useEffect, useRef } from 'react';
import { Folder, ChevronDown, ChevronRight, Plus, Trash2, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export function NodeList({ nodes, parentId, onInsert, onDelete, onToggle, onConfirmEdit, onStartEdit, onIngest, level = 0, readOnly = false, renderRightAccessory }) {
    if (!nodes) return null;

    return (
        <div className="flex flex-col">
            {nodes.map((node, index) => (
                <React.Fragment key={node.id || index}>
                    {!readOnly && onInsert && <InsertZone level={level} onInsert={() => onInsert(parentId, index)} />}
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
                        readOnly={readOnly}
                        renderRightAccessory={renderRightAccessory}
                    />
                </React.Fragment>
            ))}
            {!readOnly && onInsert && <InsertZone level={level} onInsert={() => onInsert(parentId, nodes.length)} isLast />}
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

function FolderNode({ node, parentId, onDelete, onToggle, onInsert, onConfirmEdit, onStartEdit, onIngest, level, readOnly, renderRightAccessory }) {
    // Always open by default for visibility
    const [isOpen, setIsOpen] = useState(true);
    const [isHovered, setIsHovered] = useState(false);
    const hasChildren = node.children && node.children.length > 0;

    const [editName, setEditName] = useState(node.name || "");
    const inputRef = useRef(null);

    // Sync node name if it changes externally
    useEffect(() => {
        setEditName(node.name || "");
    }, [node.name]);

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
    if (!readOnly && node.isEditing) {
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
                    "flex items-center gap-3 py-0 px-3 rounded-lg transition-all group z-20 relative",
                    (node.checked && !readOnly)
                        ? ""
                        : (!readOnly ? "opacity-60" : "hover:bg-white/5")
                )}
                style={{ paddingLeft: `${level * 24 + 12}px` }}
                onClick={(e) => {
                    // In readOnly mode, click might do nothing or toggle expand
                    if (readOnly) {
                        e.stopPropagation();
                        if (hasChildren) setIsOpen(!isOpen);
                    }
                }}
            >
                {/* Expand Toggle */}
                <button
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className={cn("h-6 w-6 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors", !hasChildren && "invisible")}
                >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {/* Checkbox (Only if NOT readOnly) */}
                {!readOnly && (
                    <div className="scale-110">
                        <Checkbox checked={node.checked} onCheckedChange={(c) => onToggle && onToggle(node.id, c)} className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </div>
                )}

                {/* Folder Icon & Name */}
                <div
                    className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                    onClick={(e) => {
                        if (!readOnly && onStartEdit) {
                            e.stopPropagation();
                            onStartEdit(node.id);
                        }
                    }}
                >
                    <Folder className={cn(
                        "h-5 w-5 shrink-0 transition-colors",
                        (node.checked || readOnly)
                            ? "fill-primary text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                            : "fill-muted text-muted-foreground"
                    )} />
                    <span className={cn(
                        "font-mono truncate tracking-tight transition-colors",
                        (node.checked || readOnly)
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground decoration-line-through",
                        (!readOnly && "hover:underline hover:text-primary")
                    )}>
                        {node.name}
                    </span>
                </div>

                {/* Right Accessory (Logs, Badges) */}
                {renderRightAccessory && (
                    <div className="ml-2">
                        {renderRightAccessory(node)}
                    </div>
                )}

                {/* Hover Actions */}
                {isHovered && !readOnly && (
                    <div className="flex items-center gap-1 ml-auto animate-in fade-in duration-200">
                        {/* Ingest Button (Only if NOT readOnly, wait, Ingest might be allowed in ReadOnly view too?) 
                           The requirements say "Ingest Report... when clicked on it". 
                           Structure Editor allows Ingest. Projects View allows Ingest.
                           If readOnly is true (Projects View), we still want Ingest Button?
                           Yes. 
                        */}
                        {onIngest && (
                            <Button
                                variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-500/20 hover:text-blue-500 rounded-full"
                                title="Ingest footage here"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onIngest(node);
                                }}
                            >
                                <HardDrive className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        {onInsert && (
                            <Button
                                variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10 hover:text-primary rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onInsert(node.id, 0);
                                    setIsOpen(true);
                                }}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        )}

                        {onDelete && (
                            <Button
                                variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/20 hover:text-red-500 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm("Delete this folder and all contents?")) onDelete(node.id);
                                }}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                )}

                {/* ReadOnly Hover Actions (Just Ingest) */}
                {isHovered && readOnly && onIngest && (
                    <div className="flex items-center gap-1 ml-auto animate-in fade-in duration-200">
                        <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-500/20 hover:text-blue-500 rounded-full"
                            title="Ingest footage here"
                            onClick={(e) => {
                                e.stopPropagation();
                                onIngest(node);
                            }}
                        >
                            <HardDrive className="h-3.5 w-3.5" />
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
                                readOnly={readOnly}
                                renderRightAccessory={renderRightAccessory}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
