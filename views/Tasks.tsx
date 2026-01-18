import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../contexts/context';
import { storageService } from '../services/storage';
import { getMimeType } from '../services/fileUtils';
import { Job, JobStatus, Project } from '../types';
import { Card, Chip, Select, SelectItem, Button, Pagination, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Accordion, AccordionItem, Snippet, Code, Divider } from "@heroui/react";
import { RefreshCw, CheckCircle, AlertCircle, FileImage, FileVideo, X, Eye, Trash2, List, Copy } from 'lucide-react';
import { usePreview } from '../components/PreviewProvider';

const Tasks: React.FC = () => {
    const { t } = useApp();
    const { openPreview } = usePreview();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [projects, setProjects] = useState<Record<string, Project>>({});
    const [loading, setLoading] = useState(false);
    
    // Modals
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // Pagination
    const [page, setPage] = useState(1);
    const rowsPerPage = 10;

    const loadJobs = async () => {
        setLoading(true);
        try {
            const [allJobs, allProjects] = await Promise.all([
                storageService.getJobs(),
                storageService.getProjects()
            ]);
            
            // Create project map
            const projectMap: Record<string, Project> = {};
            allProjects.forEach(p => projectMap[p.id] = p);
            setProjects(projectMap);

            // Sort by createdAt desc
            allJobs.sort((a, b) => b.createdAt - a.createdAt);
            setJobs(allJobs);
        } catch (error) {
            console.error("Failed to load jobs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadJobs();
    }, []);

    const handleDeleteClick = (job: Job) => {
        setSelectedJob(job);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedJob) return;
        try {
            await storageService.deleteJob(selectedJob.id);
            const updatedJobs = jobs.filter(j => j.id !== selectedJob.id);
            setJobs(updatedJobs);
            
            // Adjust page if necessary
            const newFilteredJobs = updatedJobs.filter(job => {
                if (statusFilter !== 'all' && job.status !== statusFilter) return false;
                if (typeFilter !== 'all' && job.type !== typeFilter) return false;
                return true;
            });
            const newTotalPages = Math.ceil(newFilteredJobs.length / rowsPerPage);
            if (page > newTotalPages && newTotalPages > 0) {
                setPage(newTotalPages);
            } else if (newTotalPages === 0) {
                setPage(1);
            }

            setDeleteModalOpen(false);
            setSelectedJob(null);
        } catch (error) {
            console.error("Failed to delete job:", error);
        }
    };

    const handleDetailClick = (job: Job) => {
        setSelectedJob(job);
        setDetailModalOpen(true);
    };

    const filteredJobs = useMemo(() => {
        return jobs.filter(job => {
            if (statusFilter !== 'all' && job.status !== statusFilter) return false;
            if (typeFilter !== 'all' && job.type !== typeFilter) return false;
            return true;
        });
    }, [jobs, statusFilter, typeFilter]);

    const pages = Math.ceil(filteredJobs.length / rowsPerPage);
    const items = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return filteredJobs.slice(start, end);
    }, [page, filteredJobs]);

    const formatDuration = (start: number, end?: number) => {
        if (!end) return '-';
        const ms = end - start;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    const renderStatus = (status: JobStatus) => {
        switch (status) {
            case JobStatus.PENDING:
                return <Chip size="sm" color="default" variant="flat">{t.jobs.waiting}</Chip>;
            case JobStatus.PROCESSING:
                return <Chip size="sm" color="primary" variant="flat" startContent={<RefreshCw className="w-3 h-3 animate-spin" />}>{t.jobs.processing}</Chip>;
            case JobStatus.COMPLETED:
                return <Chip size="sm" color="success" variant="flat" startContent={<CheckCircle className="w-3 h-3" />}>{t.character.generationSuccess}</Chip>;
            case JobStatus.FAILED:
                return <Chip size="sm" color="danger" variant="flat" startContent={<AlertCircle className="w-3 h-3" />}>{t.character.generationFailed}</Chip>;
            default:
                return status;
        }
    };

    const renderType = (type: string) => {
        const icon = type.includes('video') ? <FileVideo className="w-4 h-4" /> : <FileImage className="w-4 h-4" />;
        return (
            <div className="flex items-center gap-2">
                {icon}
                <span>{t.jobTypes?.[type as keyof typeof t.jobTypes] || type}</span>
            </div>
        );
    };

    const handlePreview = async (job: Job) => {
        const paths = job.result?.paths || (job.result?.path ? [job.result.path] : []);
        if (paths.length === 0) return;

        try {
            const sources = await Promise.all(paths.map(async (path: string) => {
                let url: string;
                if (path.startsWith('remote:')) {
                    url = path.substring(7);
                } else {
                    url = await storageService.getAssetUrl(path);
                }
                const isVideo = job.type.includes('video');
                return {
                    src: url,
                    type: isVideo ? "video" : undefined,
                    sources: isVideo ? [{ src: url, type: getMimeType(path) }] : undefined
                };
            }));
            
            openPreview(sources);
        } catch (e) {
            console.error("Failed to load preview url", e);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 md:p-10 bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <div className="max-w-[1600px] mx-auto w-full flex flex-col h-full gap-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-[32px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {t.jobs.tasksTitle}
                        </h1>
                        <p className="text-[15px] text-slate-500 dark:text-slate-400 font-medium">
                            {t.jobs.tasksSubtitle}
                        </p>
                    </div>
                    {/* Removed Retry Button as requested */}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center">
                    <Select 
                        label={t.jobs.statusFilter}
                        labelPlacement="outside"
                        className="max-w-xs mt-6" 
                        size="md" 
                        variant="bordered"
                        selectedKeys={[statusFilter]}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        classNames={{
                            label: "text-[16px] font-bold text-slate-500 mb-2",
                            value: "text-[14px]",
                        }}
                    >
                        <SelectItem key="all" value="all">{t.project.filterAll}</SelectItem>
                        <SelectItem key={JobStatus.PENDING} value={JobStatus.PENDING}>{t.jobs.waiting}</SelectItem>
                        <SelectItem key={JobStatus.PROCESSING} value={JobStatus.PROCESSING}>{t.jobs.processing}</SelectItem>
                        <SelectItem key={JobStatus.COMPLETED} value={JobStatus.COMPLETED}>{t.character.generationSuccess}</SelectItem>
                        <SelectItem key={JobStatus.FAILED} value={JobStatus.FAILED}>{t.character.generationFailed}</SelectItem>
                    </Select>

                    <Select 
                        label={t.jobs.typeFilter}
                        labelPlacement="outside"
                        className="max-w-xs mt-6" 
                        size="md" 
                        variant="bordered"
                        selectedKeys={[typeFilter]}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        classNames={{
                            label: "text-[16px] font-bold text-slate-500 mb-2",
                            value: "text-[14px]",
                        }}
                    >
                        <SelectItem key="all" value="all">{t.project.filterAll}</SelectItem>
                        <SelectItem key="generate_image" value="generate_image">{t.jobTypes.generate_image}</SelectItem>
                        <SelectItem key="generate_video" value="generate_video">{t.jobTypes.generate_video}</SelectItem>
                    </Select>

                    {(statusFilter !== 'all' || typeFilter !== 'all') && (
                        <Button 
                            size="sm" 
                            variant="light" 
                            color="danger" 
                            className="mt-6"
                            startContent={<X className="w-4 h-4" />}
                            onPress={() => { setStatusFilter('all'); setTypeFilter('all'); }}
                        >
                            {t.jobs.clearFilters}
                        </Button>
                    )}
                </div>

                {/* Table */}
                <Card className="flex-1 overflow-hidden" shadow="sm" radius="lg">
                    <Table 
                        aria-label={t.jobs.tasksTable}
                        isHeaderSticky
                        classNames={{
                            wrapper: "h-full overflow-auto shadow-none",
                            th: "bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold uppercase text-[15px] tracking-wider",
                            td: "text-[15px]"
                        }}
                        bottomContent={
                            pages > 1 ? (
                                <div className="flex w-full justify-center pb-4">
                                    <Pagination
                                        isCompact
                                        showControls
                                        showShadow
                                        color="primary"
                                        page={page}
                                        total={pages}
                                        onChange={(page) => setPage(page)}
                                    />
                                </div>
                            ) : null
                        }
                    >
                        <TableHeader>
                            <TableColumn key="status">{t.jobs.status}</TableColumn>
                            <TableColumn key="type">{t.jobs.type}</TableColumn>
                            <TableColumn key="project">{t.jobs.project}</TableColumn>
                            <TableColumn key="userPrompt" width={250}>{t.jobs.userPrompt}</TableColumn>
                            <TableColumn key="prompt" width={250}>{t.jobs.finalPrompt}</TableColumn>
                            <TableColumn key="created">{t.jobs.created}</TableColumn>
                            <TableColumn key="duration">{t.jobs.duration}</TableColumn>
                            <TableColumn key="actions" align="end">{t.common.actions}</TableColumn>
                        </TableHeader>
                        <TableBody items={items} emptyContent={t.jobs.noTasks}>
                            {(item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{renderStatus(item.status)}</TableCell>
                                    <TableCell>{renderType(item.type)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {projects[item.projectId]?.name || '-'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[200px] truncate text-slate-700 dark:text-slate-200 font-medium" title={item.params.userPrompt}>
                                            {item.params.userPrompt || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[200px] truncate text-slate-500 text-[13px]" title={item.params.prompt}>
                                            {item.params.prompt || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>{formatDuration(item.createdAt, item.updatedAt)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-2">
                                            {item.result?.path && (
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    onPress={() => handlePreview(item)}
                                                >
                                                    <Eye className="w-4 h-4 text-slate-500" />
                                                </Button>
                                            )}
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                onPress={() => handleDetailClick(item)}
                                            >
                                                <List className="w-4 h-4 text-slate-500" />
                                            </Button>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                color="danger"
                                                onPress={() => handleDeleteClick(item)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* Delete Confirmation Modal */}
                <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
                    <ModalContent>
                        {(onClose) => (
                            <>
                                <ModalHeader className="flex flex-col gap-1">
                                    {t.jobs.deleteTask}
                                </ModalHeader>
                                <ModalBody>
                                    <p>{t.jobs.confirmDeleteTask}</p>
                                </ModalBody>
                                <ModalFooter>
                                    <Button variant="light" onPress={onClose}>
                                        {t.common.cancel}
                                    </Button>
                                    <Button color="danger" onPress={() => {
                                        confirmDelete();
                                        onClose();
                                    }}>
                                        {t.common.delete}
                                    </Button>
                                </ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>

                {/* Detail Modal */}
                <Modal 
                    isOpen={detailModalOpen} 
                    onClose={() => setDetailModalOpen(false)}
                    size="3xl"
                    scrollBehavior="inside"
                >
                    <ModalContent>
                        {(onClose) => (
                            <>
                                <ModalHeader className="flex flex-col gap-1">
                                    {t.jobs.details}
                                    <span className="text-sm font-normal text-default-500">ID: {selectedJob?.id}</span>
                                </ModalHeader>
                                <ModalBody>
                                    {selectedJob && (
                                        <div className="flex flex-col gap-4">
                                            {/* Basic Info */}
                                            <div className="grid grid-cols-2 gap-4 p-4 bg-default-50 rounded-lg">
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.project}</span>
                                                    <p>{projects[selectedJob.projectId]?.name || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.feature}</span>
                                                    <p>
                                                        {selectedJob.params?.assetType 
                                                            ? (t.project[selectedJob.params.assetType as keyof typeof t.project] || selectedJob.params.assetType)
                                                            : '-'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.assetName}</span>
                                                    <p>{selectedJob.params?.assetName || '-'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.status}</span>
                                                    <div className="mt-1">{renderStatus(selectedJob.status)}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.created}</span>
                                                    <p>{new Date(selectedJob.createdAt).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.duration}</span>
                                                    <p>{formatDuration(selectedJob.createdAt, selectedJob.updatedAt)}</p>
                                                </div>
                                            </div>

                                            {/* Prompts Display */}
                                            <div className="flex flex-col gap-3 p-4 bg-default-50 rounded-lg">
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.userPrompt}</span>
                                                    <p className="text-sm whitespace-pre-wrap">{selectedJob.params.userPrompt || '-'}</p>
                                                </div>
                                                <Divider />
                                                <div>
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.finalPrompt}</span>
                                                    <p className="text-sm font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded mt-1 whitespace-pre-wrap">{selectedJob.params.prompt || '-'}</p>
                                                </div>
                                            </div>
                                            <Divider />

                                            {/* Raw API Response */}
                                            {selectedJob.result?.meta && (
                                                <div className="flex flex-col gap-3 p-4 bg-default-50 rounded-lg">
                                                    <span className="text-xs text-default-500 uppercase font-bold">{t.jobs.rawApiResponse}</span>
                                                    <div className="max-h-60 overflow-y-auto">
                                                        <Snippet 
                                                            symbol="" 
                                                            codeString={JSON.stringify(selectedJob.result.meta, null, 2)}
                                                            color="default"
                                                            variant="flat"
                                                            fullWidth
                                                            classNames={{
                                                                pre: "whitespace-pre-wrap break-all font-mono text-xs",
                                                                base: "p-0 bg-transparent"
                                                            }}
                                                        >
                                                            {/* Display only first few lines if too long, or rely on scroll */}
                                                            <div className="text-xs font-mono whitespace-pre-wrap">
                                                                {JSON.stringify(selectedJob.result.meta, null, 2)}
                                                            </div>
                                                        </Snippet>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Accordion for JSONs */}
                                            <Accordion selectionMode="multiple" defaultExpandedKeys={["input"]} motionProps={{}}>
                                                <AccordionItem 
                                                    key="input" 
                                                    aria-label={t.jobs.inputParams} 
                                                    title={
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold">{t.jobs.inputParams}</span>
                                                            <span className="text-xs text-default-400 font-normal">{t.jobs.jsonInput}</span>
                                                        </div>
                                                    }
                                                >
                                                    <div className="relative group">
                                                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto max-h-60 text-xs">
                                                            {JSON.stringify(selectedJob.params, null, 2)}
                                                        </pre>
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="flat"
                                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onPress={() => navigator.clipboard.writeText(JSON.stringify(selectedJob.params, null, 2))}
                                                            aria-label={t.jobs.copyJson}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </AccordionItem>
                                                <AccordionItem 
                                                    key="output" 
                                                    aria-label={t.jobs.outputResult} 
                                                    title={
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold">{t.jobs.outputResult}</span>
                                                            <span className="text-xs text-default-400 font-normal">{t.jobs.jsonOutput}</span>
                                                        </div>
                                                    }
                                                >
                                                    <div className="relative group">
                                                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-auto max-h-60 text-xs">
                                                            {JSON.stringify(selectedJob.result || selectedJob.error || {}, null, 2)}
                                                        </pre>
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="flat"
                                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onPress={() => navigator.clipboard.writeText(JSON.stringify(selectedJob.result || selectedJob.error || {}, null, 2))}
                                                            aria-label={t.jobs.copyJson}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </AccordionItem>
                                            </Accordion>
                                        </div>
                                    )}
                                </ModalBody>
                                <ModalFooter>
                                    <Button color="primary" onPress={onClose}>
                                        {t.common.close}
                                    </Button>
                                </ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            </div>
        </div>
    );
};

export default Tasks;
